import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'
import { useEffect, useRef, useState } from 'react'


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

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [startTime, setStartTime] = useState();
  const [localStream, setLocalStream] = useState();
  const [stateConnection, setStateConnection] = useState(undefined);
  const [showCopyPasteAreaOffer, setShowCopyPasteAreaOffer] = useState(false);
  const [showCopyPasteAreaAnswer, setShowCopyPasteAreaAnswer] = useState(true);
  
  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    mediaButton.current.disabled = false;
    peerConnectionButton.current.disabled = true;
    createOfferButton.current.disabled = true;
    createAnswerButton.current.disabled = true;
    hangupButton.current.disabled = false;
  }, []);
  
  const handleHangup = () => {
    copyAnswerSdpTextArea.current.value = '';
    copyOfferSdpTextArea.current.value = '';
    answerSdpTextArea.current.value = '';
    offerSdpTextArea.current.value = '';
    console.log('Ending call');
    peerConnection.close();
    setPeerConnection(null);
    hangupButton.current.disabled = true;
    createOfferButton.current.disabled = true;
    createAnswerButton.current.disabled = true;
  }


  const handleMedia = async () => {
    mediaButton.current.disabled = true;

    // if(localStream) {
    //   localVideo.current.srcObject = null;
    //   localStream.getTrack().forEach(track => track.stop());
    // }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
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
    pc.ontrack = ({ streams: [stream] }) => {
      console.log('ontrack', stream);
      if (remoteVideo.current.srcObject !== stream) return;
        
      console.log(`chego aqui`)
      remoteVideo.current.srcObject = stream;
    };
    
    pc.oniceconnectionstatechange = (event) => {
      if (pc) {
        setStateConnection(pc.iceConnectionState);
        console.log(pc.iceConnectionState);
      }
    }
    pc.onconnectionstatechange = (event) => {
      console.log('handleconnectionstatechange');
      console.log(event);
    }
    console.log(localStream.getTracks());
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    setPeerConnection(pc);
    console.log('Added local stream to local');

    createAnswerButton.current.disabled = false;
    createOfferButton.current.disabled = false;
  }

  const createOffer = async () => {
    createAnswerButton.current.disabled = true;
    createOfferButton.current.disabled = true;
    setShowCopyPasteAreaOffer(true);
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      copyOfferSdpTextArea.current.value = offer.sdp;
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
            <button ref={createAnswerButton} onClick={createAnswer}>create answer</button>
            <button ref={hangupButton} onClick={handleHangup}>hangup</button>
        </div>
        {showCopyPasteAreaOffer && <div className='box'>
          <button onClick={setAnswer}>set Answer</button>
          <h1>Offer SDP</h1>
          <textarea ref={copyOfferSdpTextArea}></textarea>
          <h1>answer SDP(tem q ser colado)</h1>
          <textarea ref={answerSdpTextArea}></textarea>
        </div>
        }
        {showCopyPasteAreaAnswer && <div className='box'>
          <button onClick={setOffer}>set Offer</button>
          <h1>answer SDP</h1>
          <textarea ref={copyAnswerSdpTextArea}></textarea>
          <h1>offer SDP(tem q ser colado)</h1>
          <textarea ref={offerSdpTextArea}></textarea>
        </div>
        }
        
      </main>
    </>
  )
}
