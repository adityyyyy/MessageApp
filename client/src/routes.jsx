import { useContext } from "react"
import RegisterAndLoginForm from "./RegisterAndLoginForm.jsx"
import { UserContext } from "./UserContext"
import Chat from "./Chat.jsx"

export default function Routes() {
    const {username, id} = useContext(UserContext)

    if (username) {
        return <Chat />
    }

    return (
        <RegisterAndLoginForm />
    )
}