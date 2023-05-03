import { v4 as uuidv4 } from 'uuid';

//quantidade maxima de chamada
const MAX_CALLS = 50;
//tempo de tentativa para entre cada chamada
const CALL_TIMEOUT = 5000;

class Call {
    constructor(name, target) {
        this.name = name;
        this.target = target;
        this.isCallComplete = false;
        this.observers = {};
    }

    attachObserver(opts) { 
        const options = Object.assign({id:uuidv4()}, opts);
        this.observers[options.id] = options.obs; 
    }

    detachAllObserver() { this.observers={}; }
    
    detachObserver(id) { 
        const deleted = delete this.observers[id];
        if(!deleted) {
            throw new Error(`não foi possivel remover o observador ${id}`);
        }
        console.log(`observador removido ${id}`);
        console.log('observers', this.observers);
    }

    _notify(data) {
        const content = Object.assign({}, data);
        if(!content.data) {
            content.data = {};
        }
        content.data.name = this.name;
        content.data.target = this.target;
        Object.values(this.observers).forEach(obs => obs(content));
    }

    complete() {
        this.isCallComplete = true;
        this._notify({type:'callcomplete', data: {callSuccess: true}});
        this._notify({type:'end'});
    }

    async call() {
        let crrCall = 0;
        while(crrCall < MAX_CALLS && !this.isCallComplete) {
            console.log(`chamada para ${this.target}, tentativa: ${crrCall}`);
            this._notify({type: 'calling'});
            await new Promise(resolve => setTimeout(resolve, CALL_TIMEOUT));
            crrCall++;
        }
        if(this.isCallComplete) {
            this.isCallComplete = true;
            this._notify({type:'callcomplete', data: {callSuccess: false}});
            this._notify({type:'end'});
        }
    }
}

export default Call;