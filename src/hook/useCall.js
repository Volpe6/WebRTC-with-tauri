import { useEffect, useState } from "react";
import useAuth from "./useAuth";
import useConnection from "./useConnection";
import { toast } from "react-toastify";
import Call from "@/models/call";

//TODO existe a possibilidade de uma chamada ser feita ao mesmo tempo e ficar preso de algum modo.
//testar e corrigir isso

function useCall({socket, connections, createConnection}) {
    const { user } = useAuth();
    
    const [sentCalls, setSentCalls] = useState([]);
    const [incomingCalls, setIncomingCalls] = useState([]);

    useEffect(() => {
        if(!socket) {
            return;
        }

        function completeCall(content) {
            const call = sentCalls.find(call => call.target === content.name);
            if(call) {
                call.complete();
            }
            return call;
        }
        
        function onCall(content) {
            if(incomingCalls.find(call => call.target === content.name)) {
                console.log(`já exite uma chamada para ${content.name}`);
                return;
            }
            const incomingCall = new Call(user.name, content.name);
            incomingCall.attachObserver({
                obs: async (content) => {
                    switch(content.type) {
                        case 'callcomplete':
                            const success = content.data.callSuccess? 'atendida': 'não atendida';
                            console.log(`chamada para ${content.data.target} concluída. Estado: ${success}`);
                            if(content.data.detail) {
                                console.log(`detalhe ${content.data.detail}`);
                            }
                            break;
                        case 'end':
                            setIncomingCalls(incomingCalls.filter(call => call.target !== content.data.target));
                            break;
                    }
                }
            })
            setIncomingCalls([...incomingCalls, incomingCall]);
        }

        function onCallAccepted(content) {
            toast.info('chamada aceita');
            console.log('sents', sentCalls);
            const call = completeCall(content);
            createConnection({targetName: call.target});
        }

        function onCallRefused(content) {
            completeCall(content);
            toast.info('chamada recusada');
        }

        function onCallCanceled(content) {
            toast.info('recebendo cancelamento');
            const incomingCall = incomingCalls.find(call => call.target === content.name);
            const sentCall = sentCalls.find(call => call.target === content.name);
            if(incomingCall) {
                incomingCall.cancel();
            }
            if(sentCall) {
                sentCall.cancel();
            }
        }
        
        function onCallError(content) {
            toast.info('recebendo cancelamento');
            const call = sentCalls.find(call => call.target === content.name);
            if(call) {
                call.cancel({detail: content.detail});
            }
        }
        
        socket.on('call', onCall);
        socket.on('callaccepted', onCallAccepted);
        socket.on('callrefused', onCallRefused);
        socket.on('callerror', onCallError);
        socket.on('callcanceled', onCallCanceled);
        return () => {
            socket.off('call', onCall);
            socket.off('callaccepted', onCallAccepted);
            socket.off('callrefused', onCallRefused);
            socket.off('callerror', onCallError);
            socket.off('callcanceled', onCallCanceled);
        };
    }, [socket, incomingCalls, sentCalls]);
   
    const call = async (opts) => {
        const { targetName } = opts;
        const prevConn = connections.find(conn=> conn.name === targetName);
        if(prevConn && prevConn.peer) {
            toast.info(`ja conectado com ${targetName}`);
            return;
        }
        if(sentCalls.find(call => call.target === targetName)) {
            toast.info(`ja fazendo uma ligaçao para ${targetName}`);
            return;
        }
        if(incomingCalls.find(call => call.target === targetName)) {
            toast.info(`ja recebendo uma chamada de ${targetName}`);
            return;
        }
        const call = new Call(user.name, targetName);
        call.attachObserver({
            obs: async (content) => {
                switch(content.type) {
                    case 'calling':
                        socket.emit('call', content.data);
                        console.log(sentCalls);
                        break;
                    case 'callcomplete':
                        const success = content.data.callSuccess? 'atendida': 'não atendida';
                        console.log(`chamada para ${content.data.target} concluída. Estado: ${success}`);
                        if(content.data.detail) {
                            console.log(`detalhe ${content.data.detail}`);
                        }
                        setSentCalls(sentCalls.filter(call => call.target !== content.data.target));
                        break;
                    case 'end':
                        console.log('end disparado');
                        setSentCalls(sentCalls.filter(call => call.target !== content.data.target));
                        break;
                }
            }
        })
        setSentCalls([...sentCalls, call]);
        await call.call();
    }

    const cancel = (index) => {
        const sentCall = sentCalls[index];
        sentCall.cancel();
        socket.emit('callcanceled', {
            name: user.name,
            target: sentCall.target
        });
    }

    const acceptCall = (index) => {
        const incomingCall = incomingCalls[index];
        incomingCall.complete();
        socket.emit('callaccepted', {
            name: user.name,
            target: incomingCall.target
        });
        createConnection({targetName: incomingCall.target});
    }

    const refuseCall = (index) => {
        const incomingCall = incomingCalls[index];
        incomingCall.complete();
        socket.emit('callrefused', {
            name: user.name,
            target: incomingCall.target
        });
    }

    return {
        incomingCalls,
        sentCalls,
        call,
        acceptCall,
        refuseCall,
        cancel
    };
}

export default useCall;