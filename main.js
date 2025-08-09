const MODELS_URL = '/model';

const webcamVideoElement = document.getElementById("webcam-view");

const loaderBody = document.getElementById("loader");
const loaderTitle = document.getElementById("loader-title");

const mouthBox = document.getElementById("mouth-box");

const message = document.getElementById("message");

const calibrateBtn = document.getElementById("calibrate-btn");

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
    faceWidth: 147.94560526683927,
    maxHeight: 64.54588961601257,
    maxWidth: 59.99510630965233,
    minHeight: 8.76944875717163,
    minWidth: 43.643948674201965
}

var latestLandmarks = null;

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

async function setMessage(text) {
    message.innerText = text;
}
async function setCalibrateButtonText(text) {
    calibrateBtn.innerText = text;
}

async function setup() {
    
    updateLoaderTitle("Loading SSD Mobilenet V1...")
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL);

    updateLoaderTitle("Loading Face Landmark 68 Net...")
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);

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

function getWidth(positions) {
    return (positions[landmarks.mouthLeft].x - positions[landmarks.mouthRight].x);
}
function getWidthPercentage(positions, faceWidthPercent) {
    return clamp((getWidth(positions) - mouthCalibration.minWidth) / mouthCalibration.maxWidth) * (1 - faceWidthPercent);
}

function getHeight(positions) {
    return (positions[landmarks.mouthTop].y - positions[landmarks.mouthBottom].y);
}
function getHeightPercentage(positions, faceWidthPercent) {
    return clamp((getHeight(positions) - mouthCalibration.minHeight) / mouthCalibration.maxHeight) * (1 - faceWidthPercent);
}

function getFaceWidth(positions) {
    return (positions[landmarks.faceRight].x - positions[landmarks.faceLeft].x);
}
function getFaceWidthPercent(positions) {
    return (getFaceWidth(positions) - mouthCalibration.faceWidth) / mouthCalibration.faceWidth
}

async function processFrame(timestamp) {
    const faces = await faceapi.detectAllFaces(webcamVideoElement).withFaceLandmarks();

    if (faces.length > 0) {
        const positions = faces[0].landmarks.positions;
        const faceWidthPercentage = getFaceWidthPercent(positions);
        var mouthWidth = getWidthPercentage(positions, faceWidthPercentage);
        var mouthHeight = getHeightPercentage(positions, faceWidthPercentage);
        mouthBox.style.width = Math.round(mouthWidth * 100) + "%";
        mouthBox.style.height = Math.round(mouthHeight * 100) + "%";
        latestLandmarks = positions;
    } else {
        console.log("you have no face.");
    }

    requestAnimationFrame(processFrame);
}

var calibrationState = 0;

async function calibrate() {
    if (latestLandmarks == null) {
        setMessage("Cannot calibrate until a face is detected.");
    } else if (calibrationState == 0) {
        setMessage("Put your face in a good spot where your camera can see it.");
        setCalibrateButtonText("Done");
        calibrationState = 1;
    } else if (calibrationState == 1) {
        mouthCalibration.faceWidth = getFaceWidth(latestLandmarks);
        setMessage("Good. Now, make your mouth as skinny as you possibly can.");
        setCalibrateButtonText("Done");
        calibrationState = 2;
    } else if (calibrationState == 2) {
        mouthCalibration.minWidth = getWidth(latestLandmarks);
        setMessage("Good. Now, make your mouth as wide as you possibly can.");
        setCalibrateButtonText("Done")
        calibrationState = 3;
    } else if (calibrationState == 3) {
        mouthCalibration.maxWidth = getWidth(latestLandmarks);
        setMessage("Good. Now, make your mouth as vertically short as you possibly can.");
        setCalibrateButtonText("Done");
        calibrationState = 4;
    } else if (calibrationState == 4) {
        mouthCalibration.minHeight = getHeight(latestLandmarks);
        setMessage("Good. Now, make your mouth as vertically tall as you possibly can.");
        setCalibrateButtonText("Done");
        calibrationState = 5;
    } else if (calibrationState == 5) {
        mouthCalibration.maxHeight = getHeight(latestLandmarks);
        setMessage("Done calibrating.");
        setCalibrateButtonText("Recalibrate");
        calibrationState = 0;
    }
}

document.body.onload = async (event) => {await setup();};

webcamVideoElement.oncanplay = (event) => {processFrame();}