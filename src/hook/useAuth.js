import { createContext, useEffect, useState, useContext } from "react";
import { useRouter } from "next/router";
import { io } from 'socket.io-client';
import User from "@/models/user";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [currConnection, setCurrConnection] = useState(null);
    const router = useRouter();

    useEffect(() => {
        if(!user) {
            router.push('/login');
            return;
        }
    }, [user]);

    useEffect(() => {
        if(!socket) {
            return;
        }
        function findConnection(name) {
            const target = user.connections.find(target => target.name == name);
            if(target) {
                return target.getPeerConnection();
            }
            return null;
        }

        function onConnect() { console.log('conectado ao servidor de sinalização'); }
        function onDisconnect() { console.log('desconectado do server de sinalização'); }
        function onSubscribed() { console.log('inscrito'); }

        function onHangup(content) {
            const target = findConnection(content.name);
            if (!target) {
                console.log('recebeu hangup nao possui uma conexão rtc iniciada');
                return;
            }
            target.close();
            setUser({...user, connections: user.connections.filter(conn => conn.target != content.name)});
            console.log(`${content.name} desligado`);   
        }

        function onIceCandidate(content) {
            const target = findConnection(content.name);
            if(!target) {
                console.log('recebeu uma icecandidato mas nao possui uma conexão rtc iniciada');
                return;
            }
            console.log('setando icecandidate');
            target.addIceCandidate(content.data);
        }

        function onNegotiation(content) {
            console.log(`recebendo negociação: ${content.name}`);
            const target = findConnection(content.name);
            if(!target) {
                console.log('recebeu uma negociacao mas nao possui uma conexão rtc iniciada');
                return;
            }
            target.polite = content.polite;
            console.log(`processando negociação de: ${content.name}`);
            target.treatNegotiation(content);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('negotiation', onNegotiation);
        socket.on('ice-candidate', onIceCandidate);
        socket.on('subscribed', onSubscribed);
        socket.on('hangup', onHangup);

        if(user) {
            socket.emit('subscribe', user.name);
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('negotiation', onNegotiation);
            socket.off('ice-candidate', onIceCandidate);
            socket.off('subscribed', onSubscribed);
            socket.off('hangup', onHangup);
        };
    }, [socket, user]);

    const connectSocket = () => {
        setSocket(io('http://webrtc-signaling-server.glitch.me/'));
    }

    const disconnectSocket = () => {
        if(!socket) {
            throw new Error('conexao de socket ausente');
        }
        socket.disconnect();
    }

    const singUp = async (userName) => {
        setUser({id:userName ,name:userName, connections:[]});
        connectSocket();
        router.push('/');
    }

    const singIn = () => { throw new Error('nao implementado'); }

    const getUserMedia = async () => {
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        } catch (e) {
            throw new Error(`getUserMedia() error: ${e.toString()}`);
        }
        return stream;
    }

    const hangUp = () => {
        if(!user) {
            throw new Error('vc esta tentando finalizar todas as chamadas quando o usuario nao existe');
        }
        user.connections.forEach(conn => {
            socket.emit('hangup',  {
                name: user.name,
                target: conn.target
            });
            conn.close();
        });
        setUser({...user, connections: []});
        localStream.getTracks().forEach(track => {
            track.stop();
            localStream.removeTrack(track);
        });
    }

    const createConnection = async (targetName) => {
        const stream = localStream? localStream: await getUserMedia();
        const conn = new User(targetName);
        conn.attachObserver(async (content) => {
            const strategy = {
                connectionstatechange: content => {
                    console.log('connection state', content.data);
                    if (content.data === 'failed' || content.data === 'disconnected' || content.data === 'closed') {
                        hangUp();
                    }
                },
                negotiation: content => {
                    console.log(`emitindo negociação para: ${content.target}`);
                    socket.emit('negotiation', {
                        name: content.name,
                        target: content.target,
                        data: content.data
                    });
                },
                icecandidate: content => {
                    console.log('emitindo icecandidate');
                    socket.emit('ice-candidate', {
                        name: content.name,
                        target: content.target,
                        data: content.data
                    });
                },
                track: content => {
                    console.log('lidando com track');
                //     console.log(`track`, content)
                //     const { transceiver, track, streams } = content.data;
                //     console.log('transceiver', transceiver);
                //     if(transceiver.mid == user.peer.pc.getTransceivers()[user.peer.pc.getTransceivers().length-1].mid) {
                //         track.onunmute = () => {
                //         if(screenShareRef.current.srcObject) {
                //             return;
                //         }
                //         screenShareRef.current.srcObject = streams[0];
                //         }
                //     } else {
                //         track.onunmute = () => {
                //         streams.forEach(stream => {
                //             if(remoteVideo.current.srcObject !== stream) {
                //             remoteVideo.current.srcObject = stream;
                //             }
                //         });
                //         };
                //     }
                }
            }
            const chosenStrategy = strategy[content.type];
            if(chosenStrategy) {
                chosenStrategy(content);
            }
        });
        conn.createConnection(user.name, stream);
        setCurrConnection(conn);
        setUser({...user, connections: [...user.connections, conn]});
    }

    return (
        <AuthContext.Provider value={{ 
            user, 
            socket, 
            localStream,
            currConnection,
            singUp,
            hangUp,
            createConnection
        }}>
            { children }
        </AuthContext.Provider>
    );
}

export default function useAuth() {
    return useContext(AuthContext);
}