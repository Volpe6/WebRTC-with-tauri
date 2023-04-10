import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'
import { useEffect, useRef, useState } from 'react'

import { socket } from '../socket';
import Peer from '@/utils/peer'


export default function Home() {
  const startButton = useRef(null);
  
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [peerConnection, setPeerConnection] = useState(null);
  const [peer2Connection, setPeer2Connection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [polite, setPolite] = useState(null);

  useEffect(() => {
    function onConnect() {
      console.log('conectado ao server de sinalização');
      // alert('conectado ao server de sinalização');
      socket.emit('hello');
    }

    function onDisconnect() {
      alert('desconectado do server de sinalização');
    }

    function onIceCandidate(content) {
      console.log('recebendo icecandidate');
      if(!peerConnection) {
        console.log('recebeu uma icecandidato mas nao possui uma conexão rtc iniciada');
        return;
      }
      console.log('recebeu um candidato ices');
      peerConnection.addIceCandidate(content.data);
    }

    function onNegotiation(content) {
      console.log('recebendo negociação');
      if(!peerConnection) {
        console.log('recebeu uma icecandidato mas nao possui uma conexão rtc iniciada');
        return;
      }
      peerConnection.treatNegotiation(content);
    }
    
    // function onAnswer(answer) {
    //   if(aanswer) {
    //     console.log('foi quem criou a resposta');
    //     return;
    //   }
    //   if(!peerConnection) {
    //     console.log('recebeu uma resposta mas nao possui uma conexão rtc iniciada');
    //     return;
    //   }
    //   console.log('recebeu uma resposta');
    //   console.log('resposta', answer);
    //   peerConnection.setRemoteDescription(answer)
    //   .then(() => {})
    //   .catch(error => console.log('handle aswer error:', error.toString()));
    // }

    // function onOffer(offer) {
    //   if(origin) {
    //     console.log('foi quem criou a oferta');
    //     return;
    //   }
    //   if(!peerConnection) {
    //     console.log('recebeu uma oferta mas nao possui uma conexão rtc iniciada');
    //     return;
    //   }
    //   setAanswer(true);
    //   console.log('recebeu uma oferta');
    //   peerConnection.setRemoteDescription(offer)
    //   .then(() => peerConnection.createAnswer())
    //   .then(answer => {
    //     peerConnection.setLocalDescription(answer);
    //     socket.emit('answer', answer);
    //   })
    //   .catch((error) => console.log('handle offer error:', error.toString()));
    // }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('negotiation', onNegotiation);
    // socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('hello', () => {
      // alert('hello');
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('negotiation', onNegotiation);
      // socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIceCandidate);
    };
  }, [peerConnection]);
  
  const handlePolite = (e) => {
    const bool = e.target.checked;
    console.log(bool);
    setPolite(bool);
  }

  const createOffer = async () => {
    peerConnection.createOffer();
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

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: true, audio:true});
      setLocalStream(stream);
      console.log('Received local stream');
      localVideo.current.srcObject = stream;
      const peer1 = new Peer(true);
      const peer2 = new Peer(false);
      stream.getTracks().forEach(track => peer1.pc.addTrack(track, stream));
      setPeerConnection(peer1);
      setPeer2Connection(peer2);
      // peer1.polite = polite;
      peer1.attachObserver(async (content) => {
        switch(content.type) {
          case 'negotiation':
            await peer2.treatNegotiation({
              name: content.name,
              target: content.target,
              data: content.data
            });
            break;
          // case 'negotiation':
          //   console.log('emitindo negociação')
          //   socket.emit('negotiation', {
          //     name: content.name,
          //     target: content.target,
          //     data: content.data
          //   });
          //   break;
          case 'icecandidate':
            // console.log('emitindo icecandidate')
            peer2.addIceCandidate(content.candidate);
            // socket.emit('ice-candidate', {
            //   name: content.name,
            //   target: content.target,
            //   data: content.candidate
            // });
            break;
          case 'track':
            console.log('lidando com track')
            // console.log(`track`, content)
            // const { track, streams } = content.data;
            // remoteVideo.current.srcObject = streams[0];
            break;
        }
      });
      peer2.attachObserver(async (content) => {
        switch(content.type) {
          case 'negotiation':
            await peer1.treatNegotiation({
              name: content.name,
              target: content.target,
              data: content.data
            });
            break;
          case 'icecandidate':
            // console.log('emitindo icecandidate')
            peer1.addIceCandidate(content.candidate);
            // socket.emit('ice-candidate', {
            //   name: content.name,
            //   target: content.target,
            //   data: content.candidate
            // });
            break;
          case 'track':
            console.log('lidando com track')
            console.log(`track`, content)
            const { track, streams } = content.data;
            track.onunmute = () => {
              if (remoteVideo.current.srcObject) {
                return;
              }
              remoteVideo.current.srcObject = streams[0];
            };
            break;
        }
      });
      
      
    } catch (e) {
      alert(`getUserMedia() error: ${e.toString()}`);
    }
  }

  const handleResize = () => {
    console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
    // if(startTime) {
    //   const elapsedTime = window.performance.now() - startTime;
    //   console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    //   setStartTime(null);
    // }
  }

  const handleLoadMetadata = (e, name) => {
    console.log(`${name} video videoWidth: ${e.target.videoWidth}px,  videoHeight: ${e.target.videoHeight}px`);
  }

 
  
  
  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <video ref={localVideo} onLoadedMetadata={(e) => handleLoadMetadata(e,'local')} playsInline autoPlay muted></video>
        <video ref={remoteVideo} onResize={handleResize} onLoadedMetadata={(e) => handleLoadMetadata(e, 'remote')} playsInline autoPlay></video>

        <div className="box">
            <input type="checkbox" onClick={handlePolite} />
            <button ref={startButton} onClick={start}>start</button>
            <button onClick={createOffer}>createOffer</button>
            <button onClick={handleVideo}>video</button>
            {/* <button ref={peerConnectionButton} onClick={handlePeerConnection}>init PeerConection</button>
            <button ref={createOfferButton} onClick={createOffer}>create offer</button>
            <button ref={hangupButton} onClick={handleHangup}>hangup</button> */}
        </div>
        
      </main>
    </>
  )
}
