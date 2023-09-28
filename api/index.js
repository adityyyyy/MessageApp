const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./models/USER');
const Message = require('./models/Message');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const ws = require('ws');
const fs = require('fs')

dotenv.config();
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10); 
const app = express();

app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.json());
app.use(cookieParser());
const allowed = ["https://3gjzgk0r-5173.inc1.devtunnels.ms/", process.env.CLIENT_URL];
app.use(cors({
    origin: allowed,
    credentials: true,
}));

// app.get('/your-route', (req, res) => {
//     // Set the CORS headers for this route
//     res.header('Access-Control-Allow-Origin', 'https://3gjzgk0r-5173.inc1.devtunnels.ms');
    
//     // Your route logic here
//     res.send('Hello, World!');
// });

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        if (token){
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) throw err;
                resolve(userData);    
            });
        } else {
            reject('no token');
        }
    });  
}

app.get('/test', (_req, res) => {
    res.json('test ok');
});

app.get('/messages/:userId', async (req,res) => {
    const {userId} = req.params;
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;
    console.log(userId, ourUserId);
    const messages = await Message.find({
        sender: {$in: [userId, ourUserId]},
        recipient: {$in: [userId, ourUserId]},
    }).sort({createdAt: 1});
    res.json(messages); 
}); 

app.get('/profile', async (req, res) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const userData = await jwt.verify(token, jwtSecret);
        res.json(userData);
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.get('/people', async (_req, res) => {
    const users = await User.find({}, {'_id':1,username:1});
    res.json(users);
});

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if (passOk) {
            try {
                jwt.sign({userId:foundUser.id, username}, jwtSecret, {}, (err, token) => {
                    if (err) {
                        res.status(500).json({ error: 'Token generation failed! '})
                    } else {
                        res.cookie('token', token, {sameSite:'none', secure:true}).json({
                            id: foundUser._id,
                        });
                    }
                    
                });
            } catch (err) {
                res.status(500).json({error: 'Token generation failed! '});
            };
        } else {
            res.status(401).json({error: 'Incorrect password'});
        }
    } else {
        res.status(401).json({error: 'User not found'});
    }  
});
 
app.post('/logout', (req, res) => {
    res.cookie('token', '', {sameSite: 'none', secure: true}).json('ok');
});

app.post('/register', async (req, res) => {
    const {username, password} = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
            username:username, 
            password:hashedPassword,
        });
        jwt.sign({userId:createdUser.id, username}, jwtSecret, {}, (err, token) => {
            if(err) throw err;
            res.cookie('token', token, {sameSite:'none', secure:true}).status(201).json({
                id: createdUser._id,
            });
        });
    } catch(err) { 
        if (err) throw err;
        res.status(500).json('ok');
    }
});

const server = app.listen(4040);

const wss = new ws.WebSocketServer({server});
wss.on('connection', (connection, req) => {

    function notifyAboutOnlinePeople() {
        [...wss.clients].forEach(client => {
            client.send(JSON.stringify({
                online: [...wss.clients].map(c => ({userId:c.userId, username:c.username}))
            }));
        });
    }

    connection.isAlive=true;

    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyAboutOnlinePeople();
            console.log('dead');
        }, 1000);
    }, 5000);

    connection.on('pong', () => {
        clearTimeout(connection.deathTimer);
    });

    // read username and id for this connection 
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='));
        if (tokenCookieString) {
            const token = tokenCookieString.split('=')[1]
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (err) throw err;
                    const {userId, username} = userData;
                    connection.userId = userId;
                    connection.username = username;
                });
            }
        }
    }
 
    connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        const {recipient, text, file} = messageData;
        let filename = null;
        if (file) {
            console.log('size')
            const parts = file.name.split('.');
            const ext = parts[parts.length - 1];
            filename = Date.now() + '.' + ext;
            const path = __dirname + '/uploads/' + filename;
            const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
            fs.writeFile(path, bufferData, () => {
                console.log('file saved:'+path);
            })
        }
        if (recipient && (text || file)) {
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
                file: file ? filename : null,
            });
            [...wss.clients]
                .filter(c => c.userId === recipient)
                .forEach(c => c.send(JSON.stringify({
                    text, 
                    file,
                    sender: connection.userId,
                    recipient,
                    file: file ? filename : null,
                    _id: messageDoc._id, 
                })));       
        }
    });

    // notify every connected user about online people
    notifyAboutOnlinePeople();
});
