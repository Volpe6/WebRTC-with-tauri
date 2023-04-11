const { useEffect, useRef } = require("react");

function Video({peer}) {

    const videoRef = useRef(null);
    
    useEffect(() => {
        peer.attachObserver(async (content) => {
            switch(content.type) {
                case 'track':
                    console.log('lidando com track')
                    console.log(`track`, content)
                    const { track, streams } = content.data;
                    track.onunmute = () => {
                        if (videoRef.current.srcObject) {
                            return;
                        }
                        videoRef.current.srcObject = streams[0];
                    };
                    break;
            }
        });
    }, []);

    const handleResize = () => {
        console.log(`Remote video size changed to ${videoRef.videoWidth}x${videoRef.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
        // if(startTime) {
        //   const elapsedTime = window.performance.now() - startTime;
        //   console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
        //   setStartTime(null);
        // }
    }

    const handleLoadMetadata = (e, name) => {
        console.log(`${name} video videoWidth: ${e.target.videoWidth}px,  videoHeight: ${e.target.videoHeight}px`);
    }
    return (<>
    <video ref={videoRef} onResize={handleResize} onLoadedMetadata={(e) => handleLoadMetadata(e, 'remote')} playsInline autoPlay></video>
    </>);
}

export default Video;