import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

import { socket } from '../socket';
import Peer from '@/utils/peer';
import Video from '../components/video';


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
      return connections.current.find(conn => conn.target == name);
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
    connections.current.forEach(conn => {
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
    const stream = await getMedia();
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
          case 'track':
            // alert('track');
            console.log('lidando com track')
            console.log(`track`, content)
            // const { track, streams } = content.data;
            // track.onunmute = () => {
            //   if (remoteVideo.current.srcObject) {
            //     return;
            //   }
            //   remoteVideo.current.srcObject = streams[0];
            // };
            break;
        }
      });
    } catch (e) {
      console.log(`handlePeerConnection() error: ${e.toString()}`);
      alert(`handlePeerConnection() error: ${e.toString()}`);
    }
    setPeerConnection(peer);
    connections.current = [...connections.current, peer];
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
    // peerConnection.createOffer();
    createConnection();
  }

  const call2 = () => {
    peerConnection.createOffer();
    // createConnection();
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
          <div className='flex flex-col justify-center justify-items-center space-y-5'>
            <h4>Create connection</h4>
            <input type="text" value={targetName} placeholder="targetname" onChange={handleTargetName} />
            <button className='border border-fuchsia-700 bg-fuchsia-700' onClick={call}>call</button>
            <button className='border border-fuchsia-700 bg-fuchsia-700' onClick={hangup}>desligar</button>
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
