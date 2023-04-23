
export async function getUserMedia(opts) {
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia(opts);
    } catch (e) {
        throw new Error(`getUserMedia() error: ${e.toString()}`);
    }
    return stream;
}

export async function getDisplayMedia(opts) {
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia(opts);
    } catch (e) {
        throw new Error(`getDisplayMedia() error: ${e.toString()}`);
    }
    return stream;
}