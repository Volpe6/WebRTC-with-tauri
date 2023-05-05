class User {
    constructor(name) {
        this.id = name;
        this.name = name;
        this.peer = null;
        this.messages = [];
        this.observers = {};
        this.polite = null;
    }
}

export default User;