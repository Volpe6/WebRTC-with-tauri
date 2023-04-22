import { createContext, useEffect, useState, useContext } from "react";
import useAuth from './useAuth';
import { io } from 'socket.io-client';
import User from "@/models/user";
import { DISPLAY_TYPES } from "@/models/peer";

//Para lidar com esses todos dar uma olhada no link. Como responder APENAS com transceptores. https://blog.mozilla.org/webrtc/rtcrtptransceiver-explored/

//TODO remover transivers nao usados ou reaproveita-los
//TODO tentar usar no maximo 3 transivers: 1 pra audio, 1 pra camera web cam, 1 pra tela
//TODO tratar melhor a desconexao

//TODO mudar o nome do localStream para algo mais autoeexplicativo tipo: locaUserStream(refatorar em todos os lugares q usam)

//TODO testar o seguinte codigo para ver se o transciver morre ou algo do tipo. await transceiver.sender.replaceTrack(null); transceiver.direction = "inactive";

const ConnectionContext = createContext();

export const ConnectionProvider = ({ children }) => {
    const { user, setUser } = useAuth();
    const [socket, setSocket] = useState(null);
    const [currConnection, setCurrConnection] = useState(null);
    const [userStream, setUserStream] = useState(null);
    const [displayStream, setDisplayStream] = useState(null);
    
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

        // async function addTransceiver(opts) {
        //     async function addStreamTracks(opts) {
        //         const { userAudio, userCam, display } = opts;
        //         if(userStream) {
        //             const videoTrack = userStream.getVideoTracks()[0];
        //             const audioTrack = userStream.getAudioTracks()[0];
        //             if(videoTrack) {
        //                 userCam.trackOrKind = videoTrack;
        //                 userCam.transceiverConfig.streams = [userStream];
        //             }
        //             if(audioTrack) {
        //                 userAudio.trackOrKind = audioTrack;
        //                 userAudio.transceiverConfig.streams = [userStream];
        //             }
        //         }
        //         if(displayStream) {
        //             const displayTrack = displayStream.getVideoTracks()[0];
        //             if(displayTrack) {
        //                 display.trackOrKind = displayTrack;
        //                 display.transceiverConfig.streams = [displayStream];
        //             }
        //         }
        //     }
        //     const { conn, config } = opts;
        //     const userAudio = {id:'useraudio', trackOrKind: 'audio', transceiverConfig: config};
        //     const userCam = {id:'usercam', trackOrKind: 'video', transceiverConfig: config};
        //     const display = {id:'display', trackOrKind: 'video', transceiverConfig: config};

        //     addStreamTracks({userAudio, userCam, display});

        //     conn.peer.retriveAddTransceiver(userAudio);
        //     conn.peer.retriveAddTransceiver(userCam);
        //     conn.peer.retriveAddTransceiver(display);
        // }

        async function createConn(opts) {
            const conn = new User(opts.targetName);
            conn.polite = opts.polite;
            conn.attachObserver({
                obs:async (content) => {
                    const strategy = {
                        connectionstatechange: content => {
                            console.log('connection state', content.data);
                            if (content.data === 'failed' || content.data === 'disconnected' || content.data === 'closed') {
                                hangUp();
                            }
                        },
                        signalingstatechange: content => {
                            console.log('signalingstatechange', content);
                            // if(conn.polite && content.data == 'have-remote-offer' && conn.peer.pc.getTransceivers().length > 0) {
                            //     addTransceiver({conn, config: {direction: "sendrecv"}});
                            // }
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
                        }
                    }
                    const chosenStrategy = strategy[content.type];
                    if(chosenStrategy) {
                        chosenStrategy(content);
                    }
                }
            });
            const peer = await conn.initPeer(user.name);
            if(!peer.polite) {
                peer.addTransceiver({ id:'useraudio', trackOrKind:'audio', transceiverConfig:{direction: "sendrecv"} });
                peer.addTransceiver({ id:'usercam', trackOrKind:'video', transceiverConfig:{direction: "sendrecv"} });
                peer.addTransceiver({ id:'display', trackOrKind:'video', transceiverConfig:{direction: "sendrecv"} });
            }
            peer.createOffer();
            setCurrConnection(conn);
            setUser({...user, connections: [...user.connections, conn]});
        }

        function onConnect() { console.log('conectado ao servidor de sinalização'); }
        function onDisconnect() { console.log('desconectado do server de sinalização'); }
        function onSubscribed() { console.log('inscrito'); }
        
        async function onPolite(content) {
            createConn({targetName: content.target, polite: content.polite});
        }

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
            // target.polite = content.polite;
            console.log(`processando negociação de: ${content.name}`);
            target.treatNegotiation(content);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('negotiation', onNegotiation);
        socket.on('ice-candidate', onIceCandidate);
        socket.on('subscribed', onSubscribed);
        socket.on('hangup', onHangup);
        socket.on('polite', onPolite);

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
            socket.off('polite', onPolite);
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

    const createConnection = (opts) => {
        console.log('polite', opts);
        socket.emit('polite', {name: user.name, target: opts.targetName});
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
            conn.peer.close();
        });
        setUser({...user, connections: []});
        if(userStream) {
            userStream.getTracks().forEach(track => {
                track.stop();
                userStream.removeTrack(track);
            });
        }
    }

    const getUserMedia = async (opts) => {
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia(opts);
            if(userStream) {
                stream.getTracks().forEach(track => userStream.addTrack(track));
                stream = userStream;
            }
            setUserStream(stream);
        } catch (e) {
            throw new Error(`getUserMedia() error: ${e.toString()}`);
        }
        return stream;
    }
    
    const getDisplayMedia = async (opts) => {
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia(opts);
            setDisplayStream(stream);
        } catch (e) {
            throw new Error(`getDisplayMedia() error: ${e.toString()}`);
        }
        return stream;
    }

    const toogleCamera = async () => {
        let stream = userStream;
        let videoTrack = null;
        //verifica se o user stream ja foi definido e se possui o track de video
        if(userStream && userStream.getVideoTracks()[0]) {
            console.log('possui stream a vidoe track');
            videoTrack = userStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
        }
        if(!videoTrack) {
            console.log('nao possui stream ou vidoe track');
            stream = await getUserMedia({ video: true });
            videoTrack = stream.getVideoTracks()[0];
        }
        if(!currConnection) {
            console.log('atuamente sem conec;ao');
            return;
        }
        const peer = currConnection.peer;
        const transceiver = peer.retriveTransceiver({ displayType: DISPLAY_TYPES.USER_CAM });
        if(!videoTrack.enabled) {
            transceiver.sender.replaceTrack(null);
            transceiver.direction = 'recvonly';
            return;
        }
        transceiver.direction = "sendrecv";
        transceiver.sender.replaceTrack(videoTrack);
        transceiver.sender.setStreams(stream);
    }

    // const toogleCamera = async () => {    
    //     const stream = await getUserMedia({ video: true });
    //     const peer = currConnection.peer;
    //     const tc = peer.retriveAddTransceiver({ id:'usercam', trackOrKind: 'video'});
    //     tc.direction = "sendrecv";
    //     tc.sender.replaceTrack(stream.getVideoTracks()[0]);
    //     tc.sender.setStreams(stream);
    // }

    const shareDisplay = async () => {
        const stream = await getDisplayMedia();
        const peer = currConnection.peer;
        const transceiver = peer.retriveTransceiver({ displayType: DISPLAY_TYPES.DISPLAY });
        transceiver.direction = "sendrecv";
        transceiver.sender.replaceTrack(stream.getVideoTracks()[0]);
        transceiver.sender.setStreams(stream);
    }

    return (
        <ConnectionContext.Provider value={{ 
            userStream,
            displayStream,
            currConnection,
            connectSocket,
            hangUp,
            createConnection,
            disconnectSocket,
            toogleCamera,
            shareDisplay
        }}>
            { children }
        </ConnectionContext.Provider>
    );
}

export default function useConnection() {
    return useContext(ConnectionContext);
}