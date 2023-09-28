import { useContext, useEffect, useState, useRef } from "react";
import Contact from "../Contact";
import Logo from "./logo";
import { UserContext } from "./UserContext";
import uniqby from "lodash/uniqBy";
import axios from "axios";

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const {username, id, setId, setUsername} = useContext(UserContext);
    const divUndeMessages = useRef();

    useEffect(() => {
        connectToWs();
    }, [selectedUserId]);

    useEffect(() => {
        const div = divUndeMessages.current;
        if (div) {
            div.scrollIntoView({behavior: 'smooth', block: 'end'});
        }
    }, [messages]);

    useEffect(() => {
        if(selectedUserId) {
            axios.get('/messages/' + selectedUserId).then(res => {
                setMessages(res.data);
            });
        }
    }, [selectedUserId]);

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                .filter(p => p._id !== id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeople = {};
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p;
            });
            setOfflinePeople(offlinePeople);
        });
    }, [onlinePeople]);

    function connectToWs() {
        const ws = new WebSocket('ws://localhost:4040');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            setTimeout(() => {
                console.log('Disconnected, Trying to reconnect...');
                connectToWs();
            }, 1000);
        });
    }
   
    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({userId, username}) => {
            people[userId] = username;
        });
        setOnlinePeople(people);
    }

    function handleMessage(ev) {
        const messageData = JSON.parse(ev.data);
        console.log(ev, messageData);
        if ('online' in messageData) {
            showOnlinePeople(messageData.online);
        }
        else if ('text' in messageData) {
            if (messageData.sender === selectedUserId) {
                setMessages(prev => ([...prev, {...messageData}]));
            }            
        }
    }

    function sendMessage(ev, file = null) {
        if (ev) ev.preventDefault();
        ws.send(JSON.stringify({

            recipient: selectedUserId,
            text: newMessageText,
            file,

        }));
        setNewMessageText('');
        setMessages(prev => ([...prev, {
            text: newMessageText, 
            sender: id,
            recipient: selectedUserId,
            _id: Date.now(),
        }]));
        if (file) {
            axios.get('/messages/' + selectedUserId).then(res => {
                setMessages(res.data);
            });
        } else {
            setMessages(prev => ([...prev, {
                text: newMessageText, 
                sender: id,
                recipient: selectedUserId,
                _id: Date.now(),
            }]));
        }
    }

    function sendFile(ev) {
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => {
            sendMessage(null, {
                name: ev.target.files[0].name,
                data: reader.result,
            });
        };
    }

    function logout() {
        axios.post('/logout').then(() => {
            setWs(null);
            setId(null);
            setUsername(null);
        });
    }



    const onlinePeopleExUser = {...onlinePeople};
    delete onlinePeopleExUser[id];

    const messagesWODupes = uniqby(messages, '_id');

    return (
        <div className="flex h-screen">
            <div className="bg-white-100 w-1/3 flex flex-col">
                <div className="flex-grow">
                    <Logo onClick = {() => {setSelectedUserId()}} />
                    {Object.keys(onlinePeopleExUser).map(userId => (
                        <Contact 
                            key={userId}
                            id={userId}
                            online={true}
                            username={onlinePeopleExUser[userId]}
                            onClick={() => {setSelectedUserId(userId)}}
                            selected={userId === selectedUserId} />
                    ))}
                    {Object.keys(offlinePeople).map(userId => (
                        <Contact 
                            key={userId}
                            id={userId}
                            online={false}
                            username={offlinePeople[userId].username}
                            onClick={() => setSelectedUserId(userId)}
                            selected={userId === selectedUserId} />
                    ))}
                </div>
                <div className="p-2 text-center flex items-center justify-center">
                    <span className="mr-2 text-sm text-gray-600 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                        </svg>
                        {username}
                    </span>
                    <button
                        onClick={logout} 
                        className="text-sm bg-yellow-50 px-2 py-1 text-green-400 border rounded-md">Logout</button>
                </div>
            </div>
            <div className="flex flex-col bg-blue-50 w-2/3 p-2">
                <div className="flex-grow overflow-y-scroll">
                    {!selectedUserId && (
                        <div className="flex h-full flex-grow items-center justify-centere">
                            <div className="text-gray-400">&larr; Select a person</div>
                        </div>
                    )}
                    {!!selectedUserId && (
                        <div className="h-full top-0 left-0 right-0 bottom-2">
                            {messagesWODupes.map(message => (
                                <div key={message._id} className={(message.sender === selectedUserId ? 'text-left' : 'text-right')}>
                                    <div  className={"text-left inline-block p-2 my-2 rounded-md text-sm " +(message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-500')}>
                                        {message.text}
                                        {message.file && (
                                            <div className="">
                                                <a className="flex items-center gap-1 border-b" href={axios.defaults.baseURL + '/uploads/' + message.file}  target="_blank" rel="noopener noreferrer">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                                        <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                                                    </svg>
                                                    {message.file}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div  ref={divUndeMessages}></div>
                        </div>
                         
                    )}
                </div>
                {!!selectedUserId && (
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <input 
                            value={newMessageText}
                            onChange={ev => setNewMessageText(ev.target.value)}
                            type="text" 
                            placeholder="Type your message here" 
                            className="bg-white flex-grow border p-2 rounded-lg" />
                        <label className="bg-white-500 p-2 text-gray-600 cursor-pointer rounded-md">
                            <input type="file" 
                                className="hidden" 
                                onChange={sendFile} />
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                            </svg>
                        </label>
                        <button type="submit"
                            className="bg-white-500 p-2 rounded-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                        </button>
                    </form>
                )}
                
            </div>
        </div>
    );
}