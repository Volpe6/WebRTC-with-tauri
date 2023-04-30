import { useEffect, useRef, useState } from "react";
import useAuth from '../hook/useAuth';
import useConnection from '../hook/useConnection';
import Message from "./message";
import { DISPLAY_TYPES } from "@/models/peer";
import { TYPES as MESSAGE_TYPES } from "@/models/message";
import { open } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile, BaseDirectory } from '@tauri-apps/api/fs';
//https://github.com/tauri-apps/tauri/issues/996
import { metadata } from "tauri-plugin-fs-extra-api";
import FileUpload from "@/utils/fileUpload";

function Chat() {
    const firstRender = useRef(true);
    const textInput = useRef(null);
    const [messages, setMessages] = useState([]);
    const receiveFiles = useRef([]);
    const sendFiles = useRef([]);
    // const [file, setFile] = useState(null);
    
    const [localAudioStream, setLocalAudioStream] = useState(null);
    const [localVideoStream, setLocalVideoStream] = useState(null);
    const [localDisplayStream, setLocalDisplayStream] = useState(null);

    const audioRef = useRef(null);
    const videoRef = useRef(null);
    const displayRef = useRef(null);
    const localAudioRef = useRef(null);
    const localVideoRef = useRef(null);
    const localDisplayRef = useRef(null);

    const { user } = useAuth();
    const { currConnection: conn } = useConnection();

    useEffect(() => {
        if(localAudioStream && localAudioRef.current) {
            localAudioRef.current.srcObject = localAudioStream;
        }
    }, [localAudioStream]);
    
    useEffect(() => {
        if(localVideoStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localVideoStream;
        }
    }, [localVideoStream]);
    
    useEffect(() => {
        if(localDisplayStream && localDisplayRef.current) {
            localDisplayRef.current.srcObject = localDisplayStream;
        }
    }, [localDisplayStream]);

    useEffect(() => {
        if(!firstRender.current) {
            return;
        }
        firstRender.current = false;
        conn.attachObserver({
            obs: async (content) => {
                const strategy = {
                    datachannelmessage: async content => {
                        const msgStrategy = {
                            [MESSAGE_TYPES.TEXT]: (msg) => {},
                            [MESSAGE_TYPES.FILE_META]: (msg) => {
                                const { message } = msg;
                                console.log('file meta', message);
                                const receiveFile = new FileUpload(message);
                                receiveFile.attachObserver({ 
                                    obs: async (content) => {
                                        const strategyFile = {
                                            end: content => {
                                                const { id } = content.data;
                                                receiveFiles.current = receiveFiles.current.filter(fileUpload => fileUpload.id !== id);
                                            },
                                        };
                                        const chosenFileStrategy = strategyFile[content.type];
                                        if(chosenFileStrategy) {
                                            chosenFileStrategy(content);
                                        }
                                    }
                                });
                                console.log('receiveFile', receiveFile);
                                receiveFiles.current = [...receiveFiles.current, receiveFile];
                            },
                            [MESSAGE_TYPES.CHUNK]: (msg) => {
                                const { message } = msg;
                                console.log('message', message);
                                console.log('message', receiveFiles);
                                const receiveFile = receiveFiles.current.find(fileUpload => fileUpload.id === message.id);
                                if(receiveFile) {
                                    receiveFile.receive(Uint8Array.from(message.chunk));
                                }
                            },
                        }
                        try {
                            const message = JSON.parse(content.data.data);
                            const chosenMessageStrategy = msgStrategy[message.type];
                            if(chosenMessageStrategy) {
                                chosenMessageStrategy(message);
                                conn.receive(message);
                                setMessages([...conn.getMessages()]);
                            }
                        } catch (error) {
                            console.log('nao foi possivel dar parse na mensagem');
                        }
                    },
                    changeuserstream: content => {
                        const { stream, mediaType } = content.data;
                        if(stream) {
                            if(mediaType === 'video') {
                                setLocalVideoStream(new MediaStream([stream.getVideoTracks()[0]]));
                            }
                            if(mediaType === 'audio') {
                                setLocalAudioStream(new MediaStream([stream.getAudioTracks()[0]]));
                            }
                        }
                    },
                    changedisplaystream: content => {
                        const { stream } = content.data;
                        if(stream) {
                            setLocalDisplayStream(new MediaStream(stream.getTracks()));
                        }
                    },
                    track: content => {
                        console.log('lidando com track')
                        console.log(`track`, content)
                        const { transceiver, track, streams } = content.data;
                        const trv = conn.peer.retriveTransceiver({displayType: DISPLAY_TYPES.DISPLAY});
                        let mediaRef = transceiver.mid == trv.mid? displayRef.current: videoRef.current;
                        if(track.kind === 'audio') {
                            mediaRef = audioRef.current;
                        }
                        track.onmute = () => {
                            mediaRef.srcObject = null;
                        };
                        track.onunmute = () => {
                            if (mediaRef.srcObject || streams.length == 0) {
                                return;
                            }
                            if(track.kind === 'audio') {
                                mediaRef.srcObject = new MediaStream([streams[0].getAudioTracks()[0]]);
                                return;
                            }
                            mediaRef.srcObject = new MediaStream([streams[0].getVideoTracks()[0]]);
                        };
                    },
                    close: content => {}
                };
                const chosenStrategy = strategy[content.type];
                if(chosenStrategy) {
                    chosenStrategy(content);
                }
            }
        });
    }, []);

    const sendMessage = () => {
        conn.send({message: textInput.current.value});
        textInput.current.value = '';
        setMessages([...conn.getMessages()]);
    }

    const handleFile = async () => {
        const selected = await open();
        if(!selected) {
            console.log('usuario nao escolheu nada');
            return null;
        }
        const metaData = await metadata(selected);
        metaData.fileName = selected.substring(selected.lastIndexOf('\\') + 1);
        const sendFile = new FileUpload({ path: selected, metaData, connection: conn });
        sendFile.attachObserver({
            obs: async (content) => {
                const strategy = {
                    end: content => {
                        console.log(content);
                        const { id } = content.data;
                        sendFiles.current = sendFiles.current.filter(fileUpload => fileUpload.id !== id);
                    },
                    cleanqueue: content => {
                        // Limpando a fila de envio com uma mensagem vazia
                        console.log('linpando fila');
                        conn.peer.cleanChannelqueue();
                    },
                    info: content => {
                        conn.send({
                            type: MESSAGE_TYPES.FILE_META,
                            message: content.data
                        });
                    },
                    chunk: content => {
                        content.data.chunk = Array.from(content.data.chunk);
                        conn.send({
                            type: MESSAGE_TYPES.CHUNK,
                            message: content.data
                        });
                    },
                };
                const chosenStrategy = strategy[content.type];
                if(chosenStrategy) {
                    chosenStrategy(content);
                }
            }
        });
        sendFile.send();
        sendFiles.current = [...sendFiles.current, sendFile];
        setMessages([...conn.getMessages()]);
    }

    return (<>
        <div className="flex flex-col h-screen bg-purple-700 w-full">
            <div className="flex justify-start items-center bg-purple-600 p-4 space-x-2">
                {/* <img src="https://i.pravatar.cc/50?img=2" alt="Avatar" class="rounded-full ml-2"/> */}
                <audio ref={audioRef} autoPlay></audio>
                <video ref={videoRef} width={100} playsInline autoPlay></video>
                <video ref={displayRef} width={100} playsInline autoPlay></video>
                <span>{conn.name}</span>
            </div>
            <div className="flex-1 overflow-y-scroll p-4 space-y-2">
                {messages.map((chatMsg, i) => {
                    let message = chatMsg.message;
                    if(chatMsg.type === MESSAGE_TYPES.FILE_META) {
                        message = chatMsg.message.metaData.fileName;
                    }
                    return <Message key={i} sender={chatMsg.senderId===user.id} message={message} />;
                }
                )}
            </div>
            <div className="flex justify-center items-center p-4">
                <input ref={textInput} type="text" placeholder="Digite sua mensagem" className="rounded-l-full border border-gray-400 py-2 px-4 w-full focus:outline-none focus:shadow-outline" />
                <button onClick={sendMessage}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-full">
                Enviar
                </button>
                <button onClick={handleFile}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-full">
                file
                </button>
                <audio ref={localAudioRef} autoPlay muted></audio>
                <video ref={localVideoRef} width={100} playsInline autoPlay muted></video>
                <video ref={localDisplayRef} width={100} playsInline autoPlay muted></video>
            </div>
        </div>
    </>);
}

export default Chat;