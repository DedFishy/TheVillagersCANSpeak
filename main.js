const webcamVideoElement = document.getElementById("webcam-view");

const loaderBody = document.getElementById("loader");
const loaderTitle = document.getElementById("loader-title");

const mouthBox = document.getElementById("mouth-box");

var gotWebcam = false;

const landmarks = {
    mouthLeft: 54,
    mouthRight: 48,
    mouthTop: 57,
    mouthBottom: 51,
    faceLeft: 1,
    faceRight: 13
}

var mouthCalibration = {
    faceWidth: 100,
    minHeight: 14,
    maxHeight: 52,
    minWidth: 48,
    maxWidth: 26
}

async function getWebcam() {
    if (navigator.mediaDevices.getUserMedia) {
        var stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamVideoElement.srcObject = stream;
        gotWebcam = true;
    }
}

async function updateLoaderTitle(title) {
    loaderTitle.innerText = title;
}
async function hideLoader() {
    loaderBody.classList.add("hidden");
}

async function setup() {
    
    updateLoaderTitle("Loading SSD Mobilenet V1...")
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/model');

    updateLoaderTitle("Loading Face Landmark 68 Net...")
    await faceapi.nets.faceLandmark68Net.loadFromUri('/model');

    updateLoaderTitle("Waiting for webcam permissions...")
    await getWebcam();

    if (gotWebcam) {
        hideLoader();
    } else {
        updateLoaderTitle("Failed to activate webcam.")
    }
}

function clamp(value, min=0, max=1) {
    if (value < min) return min;
    else if (value > max) return max;
    return value;
}

function getWidthPercentage(positions, faceWidthPercent) {
    return clamp(((positions[landmarks.mouthLeft].x - positions[landmarks.mouthRight].x) - mouthCalibration.minWidth) / mouthCalibration.maxWidth) * faceWidthPercent;
}

function getFaceWidthPercent(positions) {
    return (positions[landmarks.faceLeft] - positions[landmarks.faceRight]) - conf
}

async function processFrame(timestamp) {
    const faces = await faceapi.detectAllFaces(webcamVideoElement).withFaceLandmarks();

    faces.forEach((value, index, array) => {
        const positions = value.landmarks.positions;
        var mouthWidth = clamp(((positions[landmarks.mouthLeft].x - positions[landmarks.mouthRight].x) - mouthCalibration.minWidth) / mouthCalibration.maxWidth);
        var mouthHeight = clamp(((positions[landmarks.mouthTop].y - positions[landmarks.mouthBottom].y) - mouthCalibration.minHeight) / mouthCalibration.maxHeight);
        mouthBox.style.width = Math.round(mouthWidth * 100) + "%";
        mouthBox.style.height = Math.round(mouthHeight * 100) + "%";
        
    })

    requestAnimationFrame(processFrame);
}

async function calibrate() {

}

document.body.onload = async (event) => {await setup();};

webcamVideoElement.onload = (event) => {processFrame();}