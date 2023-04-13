import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

import { socket } from '../socket';
import Peer from '@/utils/peer';
import Video from '../components/video';
import { ResizableBox } from 'react-resizable';


export default function Home() {
  const startButton = useRef(null);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [peerConnection, setPeerConnection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [userName, setUserName] = useState('');
  const [targetName, setTargetName] = useState('');
  
  const connections = useRef([]);

  useEffect(() => {
    function findConnection(name) {
      // return peerConnection;
      // console.log()
      return connections.find(conn => conn.target == name);
    }

    function onConnect() {
      console.log('conectado ao server de sinalização');
      // alert('conectado ao server de sinalização');
      socket.emit('hello');
    }

    function onDisconnect() {
      alert('desconectado do server de sinalização');
    }

    function onSubscribed() {
      alert('inscrito');
    }

    function onIceCandidate(content) {
      const conn = findConnection(content.name);
      if (!conn) {
        console.log('recebeu uma icecandidato mas nao possui uma conexão rtc iniciada');
        console.log('recusado', content);
        socket.emit('ice-candidate-refused', {
          name: content.target,
          target: content.name,
          data: content.data,
          detail: 'nao possui uma conexão rtc iniciada'
        });
        return;
      }

      console.log('setando icecandidate');
      conn.addIceCandidate(content.data);
    }

    function onHangup(content) {
      const conn = findConnection(content.name);
      if (!conn) {
        console.log('recebeu hangup nao possui uma conexão rtc iniciada');
        return;
      }
      
      conn.pc.close();
      connections.current = connections.current.filter(conn => conn.target != content.name);
      console.log('connections', connections.current);
      console.log('desligado');
    }

    // function onIceCandidateRefused(content) {
    //   console.log(`onIceCandidateRefused ${content.name}: refuse icecandidate`, content.detail)
    //   refusedIce.current = [...refusedIce.current, {
    //     name: content.target,
    //     target: content.name,
    //     data: content.data
    //   }];
    // }

    function onNegotiation(content) {
      console.log('recebendo negociação');
      const conn = findConnection(content.name);
      if (!conn) {
        console.log('recebeu uma icecandidato mas nao possui uma conexão rtc iniciada');
        return;
      }
      conn.polite = content.polite;
      console.log(`processando negociação de: ${content.name}`);
      conn.treatNegotiation(content);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('negotiation', onNegotiation);
    socket.on('ice-candidate', onIceCandidate);
    //o rtcpeer nao ta iniciado do outro lado
    // socket.on('ice-candidate-refused', onIceCandidateRefused);
    socket.on('subscribed', onSubscribed);
    socket.on('hangup', onHangup);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('negotiation', onNegotiation);
      socket.off('subscribed', onSubscribed);
      socket.off('ice-candidate', onIceCandidate);
      socket.on('hangup', onHangup);

      // socket.off('ice-candidate-refused', onIceCandidateRefused);
    };
  }, [peerConnection]);
  
  const subscribe = () => {
    socket.emit('subscribe', userName);
  }

  const handleUserName = (event) => {
    setUserName(event.target.value)
  }

  const handleTargetName = (event) => {
    setTargetName(event.target.value)
  }

  const handleVideo = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    // Define a propriedade "enabled" como "false" para desativar a transmissão de vídeo
    videoTrack.enabled = !videoTrack.enabled;
  }

  const handleAudio = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    // Define a propriedade "enabled" como "false" para mutar o áudio
    audioTrack.enabled = !audioTrack.enabled;
  }

  const hangup = () => {
    connections.forEach(conn => {
      socket.emit('hangup', {
        name: userName,
        target: conn.target
      });
      conn.pc.close();
      localStream.getTracks().forEach(track =>{
        track.stop();
        localStream.removeTrack(track);
      });
      localVideo.current.srcObject = null;
      localVideo.current.srcObject = localStream;
    });
  }

  const createConnection = async () => {
    if(connections.length > 0) {
      alert('atualmente so uma conexão por vez é permitida');
      return;
    }
    const stream = localStream? localStream : await getMedia();
    console.log('chamando createConnection varias vezes');
    let peer;
    try {
      peer = new Peer();
      stream.getTracks().forEach(track => peer.pc.addTrack(track, stream));
      peer.name = userName;
      peer.target = targetName;
      peer.attachObserver(async (content) => {
        switch (content.type) {
          case 'connectionstatechange':
            console.log(content.data);
            if (content.data === 'failed' || content.data === 'disconnected' || content.data === 'closed') {
              hangup();
            }
            break;
          case 'negotiation':
            console.log(content)
            console.log(`emitindo negociação para: ${content.target}`);
            socket.emit('negotiation', {
              name: content.name,
              target: content.target,
              data: content.data
            });
            break;
          case 'icecandidate':
            console.log('emitindo icecandidate')
            socket.emit('ice-candidate', {
              name: content.name,
              target: content.target,
              data: content.data
            });
            break;
          // case 'track':
          //   console.log('lidando com track');
          //   console.log(`track`, content);
          //   const { track, streams } = content.data;
          //   track.onunmute = () => {
          //     if (remoteVideo.current.srcObject) {
          //       return;
          //     }
          //     remoteVideo.current.srcObject = streams[0];
          //   };
        }
      });
    } catch (e) {
      console.log(`handlePeerConnection() error: ${e.toString()}`);
      alert(`handlePeerConnection() error: ${e.toString()}`);
    }
    setConnections(prevConns => [...prevConns, peer]);
    peer.createOffer();
  }

  const getMedia = async () => {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localVideo.current.srcObject = stream;
    } catch (e) {
      alert(`getUserMedia() error: ${e.toString()}`);
    }
    return stream;
  }

  const call = () => {
    createConnection();
  }

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className='flex flex-row'>
        <div className='flex flex-col justify-start h-full w-[50%] bg-red-500 space-y-10 p-10'>
          <div className='flex flex-row'>
            <input type="text" value={userName} placeholder="username" onChange={handleUserName} />
            <button className='border border-fuchsia-700 bg-fuchsia-700' onClick={subscribe}>subscribe</button>
          </div>
<<<<<<< HEAD
          <div className='flex flex-col justify-center justify-items-center space-y-5'>
            <h4>Create connection</h4>
            <input type="text" value={targetName} placeholder="targetname" onChange={handleTargetName} />
            <button className='border border-fuchsia-700 bg-fuchsia-700' onClick={call}>call</button>
            <button className='border border-fuchsia-700 bg-fuchsia-700' onClick={hangup}>desligar</button>
=======
          {/* Aba para apresentar se você já está inscrito ou não  */}
          <div className="flex flex-row items-center mb-3">
            <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
            <span className="text-sm font-medium text-gray-700">You're not subscribed yet</span>
          </div>
          {/* Adicione novos spams abaixo caso necessário */}
          <div className="flex flex-col">
            <div className="flex flex-row mb-4">
              <input
                type="text"
                value={userName}
                placeholder="Enter your code"
                onChange={handleUserName}
                className="flex-grow mr-2 rounded-md py-2 px-3 border border-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button
                className="rounded-md py-2 px-4 bg-blue-500 text-white font-medium focus:outline-none hover:bg-blue-600"
                onClick={subscribe}
              >
                Subscribe
              </button>
            </div>
            <div className="flex flex-col mb-4">
              <h4 className="text-sm font-medium mb-2">Create or join a meeting</h4>
              <div className="flex flex-row mb-4">
                <input
                  type="text"
                  value={targetName}
                  placeholder="Enter your partner code"
                  onChange={handleTargetName}
                  className="flex-grow mr-2 rounded-md py-2 px-3 border border-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  className="rounded-md py-2 px-4 bg-blue-500 text-white font-medium focus:outline-none hover:bg-blue-600"
                  onClick={call}
                >
                  Join
                </button>
              </div>
              {/* Ações possíveis de serem realizadas durante a call */}
              {/*Estou usando os próprios ícones do tailwind mas achei o svg meio grande. Dá pra mudar futuramente */}
              <div className="flex flex-row justify-center items-center mb-2 space-x-2">
                <button title="Mute/Desmute Microphone" className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="21 15 21 9 15 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="21" y2="21"></line>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                  </svg>
                </button>
                <button title="Share your screen" className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                  </svg>
                </button>
                <button title="Jump Out" onClick={hangup} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1">
                    <path d="M1 1l22 22M1 23L23 1"></path>
                  </svg>

                </button>
              </div>

            </div>
            <div className="flex flex-col flex-grow" />
            <h4 className="text-sm font-medium mb-2">Chat Members</h4>
            <ul className="flex flex-col space-y-2 flex-grow overflow-auto">
              {/* Apresentar os membros logados na sala */}
              <li className="flex flex-row items-center">
                <img
                  src="https://randomuser.me/api/portraits/men/69.jpg"
                  alt="User profile"
                  className="w-6 h-6 rounded-full mr-2"
                />
                <img
                  src="https://randomuser.me/api/portraits/women/2.jpg"
                  alt="User profile"
                  className="w-6 h-6 rounded-full mr-2"
                />
              </li>
              {/* Componente de chat #IDEIA */}
              <div className="absolute bottom-20 right-30 w-80 h-96 bg-white rounded-lg shadow-lg">
                <div className="flex items-center justify-between px-7 py-3 bg-gray-200">
                  <h4 className="font-bold text-gray-800">Chat</h4>
                  <button className="text-gray-600  ">
                  </button>
                </div>
                <div className="px-4 py-3" >
                  <ul className="overflow-y-auto max-h-[400px]">
                    <li className="mb-2 text-black">
                      <span className="font-semibold">Usuário 1:</span> Olá!
                    </li>
                    <li className="mb-2 text-black">
                      <span className="font-semibold">Usuário 2:</span> Oi, tudo bem?
                    </li>
                    <li className="mb-2 text-black">
                      <span className="font-semibold">Usuário 1:</span> Sim
                    </li>
                  </ul>
                  <div className="flex space-x-2 mt-4">
                    <input
                      type="text"
                      placeholder="Digite sua mensagem"
                      className="flex-grow border text-black border-gray-400 rounded-lg p-2"
                    />
                    <button className="bg-blue-500 text-black px-4 py-2 rounded-lg">
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            </ul>
>>>>>>> 1137417 (:hammer: add hangup action again inside button click)
          </div>
        </div>
        <div className='relative w-full'>
          <ul>
            {connections.current.map((conn, i) => {
              return (<li key={i}>
                <Video peer={conn} />
              </li>);
            })}
          </ul>
          <video className='absolute top-[50%] left-[30%]' width={200} ref={localVideo} playsInline autoPlay muted></video>  
        </div>
      </main>
      {/* <main className={styles.main}>
        <video ref={localVideo} playsInline autoPlay muted></video>
        <video ref={remoteVideo} playsInline autoPlay muted></video>

        <ul>
          {connections.current.map((conn, i) => {
            return (<li key={i}>
              <Video peer={conn} />
            </li>);
          })}
        </ul>


        < className="box">
          <ul>
            <li>create connection</li>
            <li>
              <div className='box'>
                <input type="text" value={userName} placeholder="username" onChange={handleUserName} />
                <button onClick={subscribe}>subscribe</button>
              </div>
            </li>
            <li>
              <div className='box'>
                <input type="text" value={targetName} placeholder="targetname" onChange={handleTargetName} />
              </div>
            </li>
          </ul>
          <li><button onClick={() => call()}>call</button></li>
            
            {/* <button onClick={handleVideo}>video</button> */}
            {/* <button ref={peerConnectionButton} onClick={handlePeerConnection}>init PeerConection</button>
            <button ref={createOfferButton} onClick={createOffer}>create offer</button>
            <button ref={hangupButton} onClick={handleHangup}>hangup</button> */}
      
    </>
  )
}
