import { createContext, useEffect, useState, useContext } from "react";
import { useRouter } from "next/router";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const router = useRouter();

    useEffect(() => {
        if(!user) {
            router.push('/login');
            return;
        }
    }, [user]);

    const singUp = async (userName) => {
        setUser({id:userName ,name:userName, connections:[]});
        router.push('/');
    }

    const singIn = () => { throw new Error('nao implementado'); }

    return (
        <AuthContext.Provider value={{ 
            user, 
            setUser,
            singUp,
            singIn
        }}>
            { children }
        </AuthContext.Provider>
    );
}

export default function useAuth() {
    return useContext(AuthContext);
}