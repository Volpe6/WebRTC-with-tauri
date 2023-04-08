import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'
import { useEffect, useRef, useState } from 'react'


export default function Home() {
  const startButton = useRef(null);
  const callButton = useRef(null);
  const hangupButton = useRef(null);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [startTime, setStartTime] = useState();
  const [localStream, setLocalStream] = useState();
  
  const [peerConnection1, setPeerConnection1] = useState(null);
  const [peerConnection2, setPeerConnection2] = useState(null);

  useEffect(() => {
    startButton.current.disabled = false;
    callButton.current.disabled = true;
    hangupButton.current.disabled = true;
  }, []);
  
  useEffect(() => {
    startButton.current.disabled = false;
    callButton.current.disabled = true;
    hangupButton.current.disabled = true;
  }, []);

  const handleLoadMetadata = (e, name) => {
    console.log(`${name} video videoWidth: ${e.target.videoWidth}px,  videoHeight: ${e.target.videoHeight}px`);
  }
  

  const handleResize = () => {
    console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
    if(startTime) {
      const elapsedTime = window.performance.now() - startTime;
      console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
      setStartTime(null);
    }
  }

  const handleStart = async () => {
    console.log('Requesting local stream');
    startButton.current.disabled = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
      console.log('Received local stream');
      localVideo.current.srcObject = stream;
      setLocalStream(stream);
      callButton.current.disabled = false;
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
    }
  }

  const handleCall = async () => {
    callButton.current.disabled = true;
    hangupButton.current.disabled = false;
    console.log('starting call');

    setStartTime(window.performance.now());

    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`);
    }
    const pc1 = new RTCPeerConnection({});
    const pc2 = new RTCPeerConnection({});
    setPeerConnection1(pc1);
    setPeerConnection2(pc2);

    pc1.onicecandidate = (event) => {
      try {
        pc2.addIceCandidate(event.candidate);
        console.log(`pc1 success to add ICE Candidate`);
      } catch (error) {
        console.log(`pc1 failed to add ICE Candidate: ${error.toString()}`);
      }
      console.log(`pc1 ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`)
    }
    pc2.onicecandidate = ({candidate}) => {
      try {
        pc1.addIceCandidate(candidate);
        console.log(`pc2 success to add ICE Candidate`);
      } catch (error) {
        console.log(`pc2 failed to add ICE Candidate: ${error.toString()}`);
      }
    }
    pc1.oniceconnectionstatechange = (event) => {
      if (pc1) {
        console.log(`pc1 ICE state: ${pc1.iceConnectionState}`);
        console.log('ICE state change event: ', event);
      }
    }
    pc2.oniceconnectionstatechange = (event) => {
      if (pc2) {
        console.log(`pc2 ICE state: ${pc2.iceConnectionState}`);
        console.log('ICE state change event: ', event);
      }
    }
    pc2.ontrack = ({ streams: [stream] }) => {
      console.log('ontrack', stream);
      if (remoteVideo.current.srcObject !== stream) {
        remoteVideo.current.srcObject = stream;
        console.log('pc2 received remote stream');
      }
    }

    localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
    console.log('Added local stream to pc1');
    
     try {
      console.log('pc1 createOffer start');
      const offer = await pc1.createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
      });
      console.log('pc1 setLocalDescription start');
      console.log('oferta', offer)
      try {
        await pc1.setLocalDescription(offer);
        console.log(`pc1 setLocalDescription complete`);
      } catch (e) {
        console.log(`pc1 Failed to set session description: ${e.toString()}`);
      }
      console.log('pc2 setRemoteDescription start');
      try {
        await pc2.setRemoteDescription(offer);
        console.log(`pc2 setRemoteDescription complete`);
      } catch (e) {
        console.log(`pc2 Failed to set session description: ${e.toString()}`);
      }
      console.log('pc2 createAnswer start');
      try {
        const answer = await pc2.createAnswer();
        console.log('pc2 setLocalDescription start');
        try {
          await pc2.setLocalDescription(answer);
          console.log(`pc2 setLocalDescription complete`);
        } catch (e) {
          console.log(`pc2 Failed to set session description: ${e.toString()}`);
        }
        console.log('pc1 setRemoteDescription start');
        try {
          await pc1.setRemoteDescription(answer);
          console.log(`pc1 setRemoteDescription complete`);
        } catch (e) {
          console.log(`pc2 Failed to set session description: ${e.toString()}`);
        }
      } catch (e) {
        console.log(`Failed to create session description: ${e.toString()}`);
      }
    } catch (e) {
      console.log(`Failed to create session description: ${e.toString()}`);
    }
  }

  const handleHangup = () => {
    console.log('Ending call');
    peerConnection1.close();
    peerConnection2.close();
    setPeerConnection1(null);
    setPeerConnection2(null);
    hangupButton.current.disabled = true;
    callButton.current.disabled = false;
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
            <button ref={startButton} onClick={handleStart}>Start</button>
            <button ref={callButton} onClick={handleCall}>Call</button>
            <button ref={hangupButton} onClick={handleHangup}>Hang Up</button>
        </div>
      </main>
    </>
  )
}
