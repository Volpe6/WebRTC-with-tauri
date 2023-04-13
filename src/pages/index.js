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
  
  const [connections, setConnections] = useState([]);

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
      if(!conn) {
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
      if(!conn) {
        console.log('recebeu hangup nao possui uma conexão rtc iniciada');
        return;
      }
      
      conn.close();
      setConnections(connections.filter(conn => conn.target != content.name));
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
      if(!conn) {
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
  }, [peerConnection, connections]);
  
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
      conn.close();
    });
    localStream.getTracks().forEach(track =>{
      track.stop();
      localStream.removeTrack(track);
    });
    localVideo.current.srcObject = null;
    localVideo.current.srcObject = localStream;
    setLocalStream(null);
    setConnections([]);
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
        switch(content.type) {
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
      stream = await navigator.mediaDevices.getUserMedia({video: true, audio:true});
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
    <div className='min-h-screen flex'>
      <div className='bottom-0 w-[30%] h-screen flex flex-col p-4 space-y-2'>
        <input
          type="text"
          placeholder="username"
          onChange={handleUserName}
          className="border-slate-200 placeholder-slate-400 contrast-more:border-slate-400 contrast-more:placeholder-slate-500 p-2"
          />
          <button onClick={subscribe} className="bg-blue-500 hover:bg-blue-700 text-white font-bold p-2 rounded">
            inscrever-se
          </button>
          <div className='p-4 space-y-3 flex flex-col'>
            <h3>Criar conexao</h3>
            <input
              type="text"
              placeholder="targetname"
              onChange={handleTargetName}
              className="border-slate-200 placeholder-slate-400 contrast-more:border-slate-400 contrast-more:placeholder-slate-500 p-2"
            />
            <button onClick={call} className="bg-blue-500 hover:bg-blue-700 text-white font-bold p-2 rounded">
              call
            </button>
            <button onClick={hangup} className="bg-blue-500 hover:bg-blue-700 text-white font-bold p-2 rounded">
              hangup
            </button>
          </div>
          <div className='p-4 space-y-3 flex flex-col'>
            <h3>Conexoes ativas</h3>
            <ul>
              {connections.map((conn, i) =>
                  <li key={i}>
                    {conn.target}
                  </li>
              )}
            </ul>
          </div>
      </div>
      <div className='bg-purple-500 bottom-0 w-full h-screen'>
        <video className='absolute left-[50%]' width={200} ref={localVideo} playsInline autoPlay muted></video> 
        <ul>
          {connections.map((conn, i) => 
              <li key={i}>
                <Video peer={conn} />
              </li>
          )}
        </ul>
      </div>
    </div>
  )
}
