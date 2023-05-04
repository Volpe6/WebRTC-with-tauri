import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone } from '@fortawesome/free-solid-svg-icons';
import { faPhoneSlash } from '@fortawesome/free-solid-svg-icons';
import useCall from "@/hook/useCall";
import useConnection from "@/hook/useConnection";

function Connection({connection}) {
    const firstRender = useRef(true);

    const { call, hangUp } = useConnection();

    const [connectionState, setConnectionState] = useState('desconectado');
    
    useEffect(() => {
        if(!firstRender.current) {
            return;
        }
        firstRender.current = false;
        connection.attachObserver({
            obs: async (content) => {
                const strategy = {
                    connectionstatechange: async content => {
                        const state = content.data;
                        setConnectionState(state);
                    },
                    close: content => setConnectionState('desconectado')
                }
                const chosenStrategy = strategy[content.type];
                if(chosenStrategy) {
                    chosenStrategy(content);
                }
            }
        });
    }, []);

    const handleCall = async () => {
        call.call({targetName: connection.name});
    }

    const handleHangUp = () => {
        hangUp({target: connection.name})
    }

    return (
        <div className="flex items-start">
            <div className="flex flex-col items-center">
                <img className="w-10 h-10 rounded-full mr-4" src="https://via.placeholder.com/150" alt="Avatar"/>
                <div className="text-gray-500 text-xs">status: {connectionState}</div>
            </div>
            <div className="flex-1">
                <div className="font-bold">{connection.user.name}</div>
            </div>
            <div className="flex space-x-2 items-center justify-center">
                <button 
                    className="text-[6px] bg-green-500 text-white p-4 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    onClick={handleCall} 
                >
                   <FontAwesomeIcon icon={faPhone} />
                </button>
                <button 
                    className="text-[6px] bg-red-500 text-white p-4 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    onClick={handleHangUp} 
                >
                   <FontAwesomeIcon icon={faPhoneSlash} />
                </button>
            </div>
        </div>
    );
}

export default Connection;