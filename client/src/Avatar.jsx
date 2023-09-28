import PropTypes from 'prop-types';

export default function Avatar({userId, username, online}) {
    const colors = ['bg-yellow-500', 'bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-teal-500'];
    const userIdBase10 = parseInt(userId, 16);
    const colorIndex = userIdBase10 % colors.length;
    const color = colors[colorIndex];
    let border = ""
    if (online) {
        border = " border-2 border-green-800"
    }

    Avatar.propTypes = {
        userId: PropTypes.string.isRequired,
        username: PropTypes.string.isRequired,
        online: PropTypes.bool
      };

    return (
        <div className = {"w-7 h-7 relative rounded-full flex items-center "+color +" "+border}>
            <div className="text-center w-full opacity-70">{username[0]}</div>
        </div>
    );
}