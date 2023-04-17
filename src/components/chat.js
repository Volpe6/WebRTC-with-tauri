import { useEffect, useRef, useState } from "react";
import useAuth from '../hook/useAuth';
import Message from "./message";

function Chat() {
    const firstRender = useRef(true);
    const textInput = useRef(null);
    const [messages, setMessages] = useState([]);
    
    const videoRef = useRef(null);
    const localVideoRef = useRef(null);

    const { user, localStream, currConnection: conn } = useAuth();

    useEffect(() => {
        if(localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if(!firstRender.current) {
            return;
        }
        firstRender.current = false;
        conn.attachObserver(async (content) => {
            const strategy = {
                datachannelopen: content => {
                    if(conn.getPeerConnection().channel.readyState === 'open') {
                        console.log('canal de comunicao aberto');
                    }
                },
                datachannelerror: content => {throw new Error(content.data);},
                datachannelmessage: content => {
                    conn.receive(content.data.data);
                    console.log('user messages', conn.getMessages());
                    setMessages([...conn.getMessages()]);
                },
                track: content => {
                    console.log('lidando com track')
                    console.log(`track`, content)
                    const { track, streams } = content.data;
                    track.onunmute = () => {
                        if (videoRef.current.srcObject) {
                            return;
                        }
                        videoRef.current.srcObject = streams[0];
                    };
                },
                close: content => {}
            };
            const chosenStrategy = strategy[content.type];
            if(chosenStrategy) {
                chosenStrategy(content);
            }
        });
    }, []);

    const sendMessage = () => {
        conn.send(textInput.current.value);
        textInput.current.value = '';
        setMessages([...conn.getMessages()]);
    }

    return (<>
        <div className="flex flex-col h-screen bg-purple-700 w-full">
            <div className="flex justify-start items-center bg-purple-600 p-4 space-x-2">
                {/* <img src="https://i.pravatar.cc/50?img=2" alt="Avatar" class="rounded-full ml-2"/> */}
                <video ref={videoRef} width={100} playsInline autoPlay></video>
                <video srcObject={localStream} width={100} playsInline autoPlay muted></video>
                <span>{conn.name}</span>
            </div>
            <div className="flex-1 overflow-y-scroll p-4 space-y-2">
                {messages.map((msg, i) => 
                    <Message key={i} sender={msg.senderId===user.id} message={msg.message} />
                )}
            </div>
            <div className="flex justify-center items-center p-4">
                <input ref={textInput} type="text" placeholder="Digite sua mensagem" className="rounded-l-full border border-gray-400 py-2 px-4 w-full focus:outline-none focus:shadow-outline" />
                <button onClick={sendMessage}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-full">
                Enviar
                </button>
                <video ref={localVideoRef} width={100} playsInline autoPlay muted></video>
            </div>
        </div>
    </>);
}

export default Chat;