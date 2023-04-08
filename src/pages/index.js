import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'
import { useEffect, useRef, useState } from 'react'

import { socket } from '../socket';


export default function Home() {
  const mediaButton = useRef(null);
  const peerConnectionButton = useRef(null);
  const createOfferButton = useRef(null);
  const createAnswerButton = useRef(null);
  
  const callButton = useRef(null);
  const hangupButton = useRef(null);

  const answerSdpTextArea = useRef(null);
  const offerSdpTextArea = useRef(null);
  const copyAnswerSdpTextArea = useRef(null);
  const copyOfferSdpTextArea = useRef(null);
  const copyCandidatosTextArea = useRef(null);
  const candidatosTextArea = useRef(null);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [startTime, setStartTime] = useState();
  const [localStream, setLocalStream] = useState();
  const [origin, setOrigin] = useState(false);
  const [aanswer, setAanswer] = useState(false);
  const [stateConnection, setStateConnection] = useState(undefined);
  const [showCopyPasteAreaOffer, setShowCopyPasteAreaOffer] = useState(false);
  const [showCopyPasteAreaAnswer, setShowCopyPasteAreaAnswer] = useState(true);
  
  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    mediaButton.current.disabled = false;
    peerConnectionButton.current.disabled = true;
    // createOfferButton.current.disabled = true;
    // createAnswerButton.current.disabled = true;
    hangupButton.current.disabled = false;
  }, []);

  useEffect(() => {
    function onConnect() {
      console.log('conectado ao server de sinalização');
      alert('conectado ao server de sinalização');
      socket.emit('hello');
    }

    function onDisconnect() {
      alert('desconectado do server de sinalização');
    }

    function onIceCandidate(candidate) {
      if(!peerConnection) {
        console.log('recebeu uma icecandidato mas nao possui uma conexão rtc iniciada');
        return;
      }
      console.log('recebeu um candidato ices');
      peerConnection.addIceCandidate(candidate);
    }
    
    function onAnswer(answer) {
      if(aanswer) {
        console.log('foi quem criou a resposta');
        return;
      }
      if(!peerConnection) {
        console.log('recebeu uma resposta mas nao possui uma conexão rtc iniciada');
        return;
      }
      console.log('recebeu uma resposta');
      console.log('resposta', answer);
      peerConnection.setRemoteDescription(answer)
      .then(() => {})
      .catch(error => console.log('handle aswer error:', error.toString()));
    }

    function onOffer(offer) {
      if(origin) {
        console.log('foi quem criou a oferta');
        return;
      }
      if(!peerConnection) {
        console.log('recebeu uma oferta mas nao possui uma conexão rtc iniciada');
        return;
      }
      setAanswer(true);
      console.log('recebeu uma oferta');
      peerConnection.setRemoteDescription(offer)
      .then(() => peerConnection.createAnswer())
      .then(answer => {
        peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer);
      })
      .catch((error) => console.log('handle offer error:', error.toString()));
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('hello', () => {
      alert('hello');
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIceCandidate);
    };
  }, [peerConnection, origin, aanswer]);
  
  const handleHangup = () => {
    // copyAnswerSdpTextArea.current.value = '';
    // copyOfferSdpTextArea.current.value = '';
    // answerSdpTextArea.current.value = '';
    // offerSdpTextArea.current.value = '';
    console.log('Ending call');
    peerConnection.close();
    setPeerConnection(null);
    hangupButton.current.disabled = true;
    createOfferButton.current.disabled = true;
    // createAnswerButton.current.disabled = true;
  }


  const handleMedia = async () => {
    mediaButton.current.disabled = true;

    // if(localStream) {
    //   localVideo.current.srcObject = null;
    //   localStream.getTrack().forEach(track => track.stop());
    // }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: true, audio:true});
      setLocalStream(stream);
      console.log('Received local stream');
      localVideo.current.srcObject = stream;
      peerConnectionButton.current.disabled = false;
    } catch (e) {
      alert(`getUserMedia() error: ${e.toString()}`);
    }

  }

  const handleResize = () => {
    console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
    if(startTime) {
      const elapsedTime = window.performance.now() - startTime;
      console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
      setStartTime(null);
    }
  }

  const handleLoadMetadata = (e, name) => {
    console.log(`${name} video videoWidth: ${e.target.videoWidth}px,  videoHeight: ${e.target.videoHeight}px`);
  }

  const addIceCandidates = () => {
    let candidates = JSON.parse(candidatosTextArea.current.value);
    candidates.forEach(item => peerConnection.addIceCandidate(item));
  }

  const handlePeerConnection = () => {
    console.log('start call');
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`);
    }

    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`);
    }
    let configuration = {
      iceServers: [{urls: "stun:stun.stunprotocol.org"}]
    };
    
    const pc = new RTCPeerConnection(configuration);
    setPeerConnection(pc);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = ({ track, streams }) => {
      // track.onunmute = () => {
        // if (remoteVideo.current.srcObject) {
        //   return;
        // }
        console.log('stream', streams);
        remoteVideo.current.srcObject = streams[0];
        console.log('remote video', remoteVideo.current);
      // };
    };
    
    pc.onicecandidate = (event) => {
      if (event.candidate != null) {
        socket.emit('ice-candidate', event.candidate);
        // console.log('new ice candidate', event.candidate);
      } else {
        console.log('all ice candidates obeteined');
      }
    }
    pc.oniceconnectionstatechange = (event) => {
      console.log('handleconnectionstatechange', pc.iceConnectionState);
    }
    pc.onconnectionstatechange = (event) => {
      console.log('handleconnectionstatechange', event);
    }
    console.log(localStream.getTracks());
    console.log('Added local stream to local');

    // createAnswerButton.current.disabled = false;
    createOfferButton.current.disabled = false;
  }

  const createOffer = async () => {
    setOrigin(true);
    // createAnswerButton.current.disabled = true;
    // createOfferButton.current.disabled = true;
    setShowCopyPasteAreaOffer(true);
    try {
      const offer = await peerConnection.createOffer();
      console.log('criada oferta', offer);
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', offer);
    } catch (e) {
      console.log(`Failed to create session description: ${e.toString()}`);
    }
  }

  const setAnswer = async () => {
    const sdp = answerSdpTextArea.current.value
      .split('\n')
      .map(l => l.trim())
      .join('\r\n');
    
    const answer = {
      type: 'answer',
      sdp: sdp
    };
    try {
      await peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.log('handle aswer error:', error.toString());
    }
  }

  const createAnswer = async () => {
    // createAnswerButton.current.disabled = true;
    createOfferButton.current.disabled = true;
    setShowCopyPasteAreaAnswer(true);
    try {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      copyAnswerSdpTextArea.current.value = answer.sdp;
    } catch (error) {
      console.log('handle aswer error:', error.toString());
    }
  }

  const setOffer = async () => {
    const sdp = offerSdpTextArea.current.value
      .split('\n')
      .map(l => l.trim())
      .join('\r\n');
    
    const offer = {
      type: 'offer',
      sdp: sdp
    };
    try {
      await peerConnection.setRemoteDescription(offer);
    } catch (error) {
      console.log('handle aswer error:', error.toString());
    }
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

        {stateConnection}

        <div className="box">
            <button ref={mediaButton} onClick={handleMedia}>get media</button>
            <button ref={peerConnectionButton} onClick={handlePeerConnection}>init PeerConection</button>
            <button ref={createOfferButton} onClick={createOffer}>create offer</button>
            <button ref={hangupButton} onClick={handleHangup}>hangup</button>
        </div>
        
      </main>
    </>
  )
}
