import Head from 'next/head'
import { useState, useRef, useEffect } from 'react'
import useAuth from '../hook/useAuth';
import useConnection from '../hook/useConnection';
import Chat from '../components/chat';
import useCall from '@/hook/useCall';
import Connection from '@/components/connection';


export default function Home() {

  const { user } = useAuth();
  const displayRef = useRef(null);

  const { currConnection: conn, call, connections, toogleAudio, toogleCamera, toogleDisplay, hangUp } = useConnection();

  if(!user) {
    return;
  }

  // useEffect(() => {
  //   if(userStream) {
  //     displayRef.current.srcObject = displayStream;
  //   }
  // }, [displayStream]);

  const [targetName, setTargetName] = useState('');

  const handleTargetName = (event) => {
    setTargetName(event.target.value)
  }

  const handleVideo = () => {
    const videoTrack = userStream.getVideoTracks()[0];
    // Define a propriedade "enabled" como "false" para desativar a transmissão de vídeo
    videoTrack.enabled = !videoTrack.enabled;
  }

  const handleAudio = () => {
    const audioTrack = userStream.getAudioTracks()[0];
    // Define a propriedade "enabled" como "false" para mutar o áudio
    audioTrack.enabled = !audioTrack.enabled;
  }

  const handleCall = () => {
    // if(connections.length > 0) {
    //   alert('atuamente somente uma conexao por vez');
    //   return;
    // }
    call.call({targetName: targetName});
  }

  return (
    <>
      <Head>
        <title>Meet</title>
        <meta name="description" content="Your virtual meet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex flex-row h-screen overflow-hidden">
        <div className="flex flex-col justify-start w-1/4 bg-white border-r border-gray-200 px-8 py-6 min-w-[270px]">
          <div className="flex flex-row items-center mb-5">
            <h2 className="text-xl font-medium ">Meet</h2>
          </div>
          {/* Aba para apresentar se você já está inscrito ou não  */}
          <div className="flex flex-row items-center mb-3">
            <h3>Logado como: {user.name}</h3>
          </div>
          {/* Adicione novos spams abaixo caso necessário */}
          <div className="flex flex-col">
            <div className="flex flex-col mb-4">
              <h4 className="text-sm font-medium mb-2">Create or join a meeting</h4>
              <div className="flex flex-col space-y-2 mb-4">
                <input
                  type="text"
                  value={targetName}
                  placeholder="Enter your partner code"
                  onChange={handleTargetName}
                  className="flex-grow mr-2 w-full rounded-md py-2 px-3 border border-gray-400 focus:outline-none focus:border-blue-500"
                />
                {/* <button
                  className="rounded-md py-2 px-4 bg-blue-500 text-white font-medium focus:outline-none hover:bg-blue-600"
                  onClick={call}
                >
                  Join
                </button> */}
                <button
                  className="rounded-md py-2 px-4 bg-blue-500 text-white font-medium focus:outline-none hover:bg-blue-600"
                  onClick={handleCall}
                >
                  call
                </button>
                <video ref={displayRef} playsInline autoPlay></video>
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
                <button title="Jump Out" onClick={() => hangUp({target: conn.name})} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1">
                    <path d="M1 1l22 22M1 23L23 1"></path>
                  </svg>

                </button>
                <button onClick={toogleCamera}>compartilha camera</button>
                <button onClick={toogleDisplay}>compartilha tela</button>
                <button onClick={toogleAudio}>audio</button>
              </div>

            </div>
            <div className="flex">
              <h4 className="text-sm font-medium mb-2">chamadas em execuçao</h4>
              <ul>
                {call.sentCalls.map((conn, i) => 
                  <li key={i} className="flex flex-row items-center space-x-2">
                    <span>chamando: {conn.target}</span>
                  </li>
                )}
              </ul>
            </div>
            <div className="flex">
              <h4 className="text-sm font-medium mb-2">chamadas recebidas</h4>
              <ul>
                {call.incomingCalls.map((conn, i) => 
                  <li key={i} className="flex flex-row items-center space-x-2">
                    <span>recebendo chamada: {conn.name}</span>
                    <button
                      className="rounded-md py-2 px-4 bg-blue-500 text-white font-medium focus:outline-none hover:bg-blue-600"
                      onClick={() => call.acceptCall(i)}
                    >
                      aceitar
                    </button>
                    <button
                      className="rounded-md py-2 px-4 bg-blue-500 text-white font-medium focus:outline-none hover:bg-blue-600"
                      onClick={() => call.refuseCall(i)}
                    >
                      recusar
                    </button>
                  </li>
                )}
              </ul>
            </div>
            <div className="flex flex-col flex-grow" />
              <h4 className="text-sm font-medium mb-2">Conexões ativas</h4>
              <ul className="divide-y divide-gray-200 overflow-auto">
                {/* Apresentar os membros logados na sala */}
                {connections.map((conn, i) => 
                  <li key={i} className="py-4">
                    <Connection connection={conn} />
                  </li>
                )}
              </ul>
            </div>
        </div>
        {conn && <Chat />}
      </main>
    </>
  )
}