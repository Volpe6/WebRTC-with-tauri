import { createContext, useEffect, useState, useContext } from "react";
import useAuth from './useAuth';
import { io } from 'socket.io-client';
import Connection from "@/models/connection";
import { toast } from "react-toastify";
import { getDisplayMedia, getUserMedia } from '../utils/mediaStream';

const ConnectionContext = createContext();

//TODO: melhorar conexão
//TODO: melhorar desconeçao
//TODO: melhorar envio de arquivos
//TODO: melhorar tratamento de erros
//TODO: melhorar tratamento de erros no envio de arquivos

//TODO quando a conexao fechar nao matar o chat so peer connection
//TODO na reconexao tbm disparar o polite para definir novamente quem é o politico e o inpolitico

export const ConnectionProvider = ({ children }) => {
    const { user, setUser } = useAuth();
    const [socket, setSocket] = useState(null);
    const [currConnection, setCurrConnection] = useState(null);
    const [userStream, setUserStream] = useState(null);
    const [displayStream, setDisplayStream] = useState(null);
    const [subscribed, setSubscribed] = useState(false);

    useEffect(() => {window.user = user}, [user]);
    
    useEffect(() => {
        if(!socket) {
            return;
        }

        function findConnection(name) {
            const target = user.connections.find(target => target.name == name);
            if(target) {
                return target.peer;
            }
            return null;
        }

        async function createConn(opts) {
            if(findConnection(opts.targetName)) {
                toast.warning(`conexao para user ${opts.targetName} ja existe`);
                return;
            }
            async function connect(opts) {
                const { conn } = opts;
                await conn.tryConnect({userName:user.name});
            }
            const conn = new Connection(opts.targetName);
            conn.polite = opts.polite;
            conn.socket = socket;
            conn.attachObserver({
                obs:async (content) => {
                    const strategy = {
                        error: content => toast.error(content.data),
                        // info: content => toast.warn(content.data),
                        connectionfailed: content => {
                            console.log('conexao falhou');
                            hangUp();
                        },
                        retryconnection: async content => {
                            toast.warning('reconectando');
                            await connect({conn: conn});
                        },
                        datachannelopen: content => {
                            if(conn.peer.channel.readyState === 'open') {
                                toast.info('canal de comunicação aberto');
                            }
                        },
                        datachannelclose: content => {
                            // conn.peer.close();
                        },
                        datachannelerror: content => {throw content.data},
                        connectionstatechange: async content => {
                            const state = content.data;
                            console.log('connection state', state);
                            switch(state) {
                                case "connected":
                                    // toast.dismiss();
                                    toast.info('conectado');
                                    break;
                                case "failed":
                                case "disconnected":
                                case "closed":
                                    if(!peer.closed && !conn.tryingConnect) {
                                        conn.retryConnect();
                                    }
                                    break;
                            }
                        },
                        signalingstatechange: async (content) => {
                            console.log('signalingstatechange', content);
                            if(conn.polite && content.data === 'have-remote-offer') {
                                await conn.toogleAudio({ enabled:true });
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
                        }
                    }
                    const chosenStrategy = strategy[content.type];
                    if(chosenStrategy) {
                        chosenStrategy(content);
                    }
                }
            });
            setCurrConnection(conn);
            setUser({...user, connections: [...user.connections, conn]});
            await connect({conn: conn});
        }

        function onConnect() { console.log('conectado ao servidor de sinalização'); }
        function onDisconnect() { console.log('desconectado do server de sinalização'); }
       
        function onSubscribed() { 
            setSubscribed(true);
            console.log('inscrito'); 
        }
        
        async function onPolite(content) {
            createConn({targetName: content.target, polite: content.polite});
        }

        function onHangup(content) {
            const target = findConnection(content.name);
            if (!target) {
                console.log('recebeu hangup nao possui uma conexão rtc iniciada');
                return;
            }
            // target.closed = true;
            // target.close();
            // if(currConnection && currConnection.name === content.name) {
            //     setCurrConnection(null);
            // }
            // setUser({...user, connections: user.connections.filter(conn => conn.name != content.name)});
            // console.log(`${content.name} desligado`);   
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
        /** utilizado para saber se o peer desse lado da conexao é o indelicado ou nao em relaçao a conexao q se deseja ser estabelecida. 
         * Essa informaçao so é retornada para o lado q requisitou, o par de comparaçao não é notificado*/
        socket.on('polite', onPolite);

        if(user && !subscribed) {
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
                target: conn.name
            });
            conn.close();
        });
        setUser({...user, connections: []});
        if(userStream) {
            userStream.getTracks().forEach(track => {
                track.stop();
                userStream.removeTrack(track);
            });
        }
        if(displayStream) {
            displayStream.getTracks().forEach(track => {
                track.stop();
                displayStream.removeTrack(track);
            });
        }
        if(currConnection) {
            setCurrConnection(null);
        }
    }

    const toogleAudio = async (opts) => {
        if(!currConnection) {
            console.log('atuamente sem conexao');
            return;
        }
        await currConnection.toogleAudio(opts);
        //a ideia do codigo abaixo era mostrar o video caso o usuario quisesse antes da conexao, e se houvesse conexao ja lincar a ela. Necessario pensar mais sobre
        // if(!userStream) {
        //     setUserStream(await getUserMedia({ video: true }));
        // }
    }

    const toogleCamera = async (opts) => {
        if(!currConnection) {
            console.log('atuamente sem conexao');
            return;
        }
        await currConnection.toogleCamera(opts);
        //a ideia do codigo abaixo era mostrar o video caso o usuario quisesse antes da conexao, e se houvesse conexao ja lincar a ela. Necessario pensar mais sobre
        // if(!userStream) {
        //     setUserStream(await getUserMedia({ video: true }));
        // }
    }

    const toogleDisplay = async (opts) => {
        if(!currConnection) {
            console.log('atuamente sem conexao');
            return;
        }
        await currConnection.toogleDisplay({onended: () => setDisplayStream(null)});
        //a ideia do codigo abaixo era mostrar o display antes da conexao caso o usuario quisesse, e se houvesse conexao ja lincar a ela. Necessario pensar mais sobre
        // setDisplayStream(stream);
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
            toogleAudio,
            toogleCamera,
            toogleDisplay
        }}>
            { children }
        </ConnectionContext.Provider>
    );
}

export default function useConnection() {
    return useContext(ConnectionContext);
}