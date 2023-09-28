import PropTypes from 'prop-types';
import Avatar from "./src/Avatar";

export default function Contact({id, username, onClick, selected, online}) {

    Contact.propTypes = {
        id: PropTypes.string,
        onClick: PropTypes.func.isRequired,
        username: PropTypes.string.isRequired,
        selected: PropTypes.bool,
        online: PropTypes.bool,
      };

    return (
    <div key={id} 
        onClick={() => onClick(id)}
        className={"border-b border-gray-100 p-2 flex items-center gap-2 cursor-pointer "+(selected ? 'bg-blue-50' : '')}>
        {selected && (
            <div className="bg-red-500 rounded-full " style={{ minWidth: '0.2rem', minHeight: '2rem' }}></div>
        )}
        <div className="flex gap-2 py-2 pl-4 items-center">
            <Avatar online={online} username={username} userId={id} />
            <span className="text-gray-800">{username}</span>
        </div>
    </div>
    );
    

}