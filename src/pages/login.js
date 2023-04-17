import Head from 'next/head';
import Image from 'next/image';
import { useState } from 'react';
import useAuth from '../hook/useAuth';

function Login() {
  const { singUp } = useAuth();
  const [userName, setUserName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    singUp(userName);
  }

  return (
    <div className="relative flex h-screen w-screen flex-col bg-slate-50 md:items-center md:justify-center md:bg-transparent">
      <Head>
        <title>colocar titulo</title>
      </Head>
      
      <form
        className="relative mt-24 space-y-8 rounded bg-slate-500 py-10 px-6 md:mt-0 md:max-w-md md:px-14"
        onSubmit={handleSubmit}
      >
        <h1 className="text-4xl font-semibold">Junte-se a nós</h1>
        <div className="space-y-4">
          <label className="inline-block w-full">
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="userName"
              className={`flex-grow w-full mr-2 rounded-md py-2 px-3 border border-gray-400 focus:outline-none focus:border-blue-500`}
            />
          </label>
        </div>
        <button
          className="w-full rounded bg-green-600 py-3 font-semibold"
          type="submit"
        >
          inscrever-se
        </button>
      </form>
    </div>
  )
}

export default Login;