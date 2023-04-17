function Message({sender, message}) {
    // <div class="flex items-start">
    //                 <img src="https://i.pravatar.cc/50?img=1" alt="Avatar" class="rounded-full mr-2"/>
    //                 <div class="bg-gray-100 rounded-lg p-2">
    //                 <p class="text-sm">Olá! Como posso ajudar você hoje?</p>
    //                 </div>
    //             </div>
    //             <div class="flex items-end">
    //                 <div class="bg-blue-500 text-white rounded-lg p-2">
    //                 <p class="text-sm">Bom dia! Gostaria de saber mais sobre o produto X.</p>
    //                 </div>
    //                 <img src="https://i.pravatar.cc/50?img=2" alt="Avatar" class="rounded-full ml-2"/>
    //             </div>
    return (<>
        <div className={`flex ${sender? 'items-end justify-end':'items-start justify-start'}`}>
            <div className={`rounded-lg p-2 ${sender?'bg-blue-500 text-white': 'bg-gray-100'}`}>
                <p className="text-sm">{message}</p>
            </div>
        </div>
    </>);
}

export default Message;