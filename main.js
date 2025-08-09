const MODELS_URL = "/model";
const DEBUG = false;
const WIDTH_TABLE = ["A", "B", "C", "D", "E", "F", "G"];
const HEIGHT_TABLE = ["1", "2", "3", "4", "5", "6", "7", "8"];

const webcamVideoElement = document.getElementById("webcam-view");
const loaderBody = document.getElementById("loader");
const loaderTitle = document.getElementById("loader-title");
const mouthBox = document.getElementById("mouth-box");
const message = document.getElementById("message");
const calibrateBtn = document.getElementById("calibrate-btn");
const calibrationMouthView = document.getElementById("calibration-mouth");
const calibrationOverlay = document.getElementById("calibration-overlay");

const synth = new Tone.Synth().toDestination();

const languages = {
    "🎵": playTones,
    "📻": playMorse
}

var gotWebcam = false;

const landmarks = {
    mouthLeft: 54,
    mouthRight: 48,
    mouthTop: 57,
    mouthBottom: 51,
    faceLeft: 1,
    faceRight: 13,
};

var mouthCalibration = {
    faceWidth: 147.94560526683927,
    maxHeight: 64.54588961601257,
    maxWidth: 59.99510630965233,
    minHeight: 8.76944875717163,
    minWidth: 43.643948674201965,
};

var latestLandmarks = null;

async function getWebcam() {
    if (navigator.mediaDevices.getUserMedia) {
        var stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamVideoElement.srcObject = stream;
        gotWebcam = true;
    }
}

async function hideCalibration() {
    calibrationOverlay.style.display = "none";
}
if (DEBUG) hideCalibration();
async function showCalibration() {
    calibrationOverlay.style.display = "flex";
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

async function setMouthSize(width, height) {
    calibrationMouthView.style.width = width + "%";
    calibrationMouthView.style.height = height + "%";
    calibrationMouthView.style.left = 50 - width / 2 + "%";
}

async function setup() {
    await setMouthSize(20, 10);

    updateLoaderTitle("Loading SSD Mobilenet V1...");
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL);

    updateLoaderTitle("Loading Face Landmark 68 Net...");
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);

    updateLoaderTitle("Waiting for webcam permissions...");
    await getWebcam();

    if (gotWebcam) {
        hideLoader();
    } else {
        updateLoaderTitle("Failed to activate webcam.");
    }
}

function clamp(value, min = 0, max = 1) {
    if (value < min) return min;
    else if (value > max) return max;
    return value;
}

function getWidth(positions) {
    return positions[landmarks.mouthLeft].x - positions[landmarks.mouthRight].x;
}
function getWidthPercentage(positions, faceWidthPercent) {
    return (
        clamp(
            (getWidth(positions) - mouthCalibration.minWidth) /
                mouthCalibration.maxWidth
        ) *
        (1 - faceWidthPercent)
    );
}

function getHeight(positions) {
    return positions[landmarks.mouthTop].y - positions[landmarks.mouthBottom].y;
}
function getHeightPercentage(positions, faceWidthPercent) {
    return (
        clamp(
            (getHeight(positions) - mouthCalibration.minHeight) /
                mouthCalibration.maxHeight
        ) *
        (1 - faceWidthPercent)
    );
}

function getFaceWidth(positions) {
    return positions[landmarks.faceRight].x - positions[landmarks.faceLeft].x;
}
function getFaceWidthPercent(positions) {
    return (
        (getFaceWidth(positions) - mouthCalibration.faceWidth) /
        mouthCalibration.faceWidth
    );
}

async function processFrame(timestamp) {
    const faces = await faceapi
        .detectAllFaces(webcamVideoElement)
        .withFaceLandmarks();

    if (faces.length > 0) {
        const positions = faces[0].landmarks.positions;
        const faceWidthPercentage = getFaceWidthPercent(positions);
        var mouthWidth = getWidthPercentage(positions, faceWidthPercentage);
        var mouthHeight = getHeightPercentage(positions, faceWidthPercentage);
        mouthBox.style.width = Math.round(mouthWidth * 100) + "%";
        mouthBox.style.height = Math.round(mouthHeight * 100) + "%";
        latestLandmarks = positions;
        if (calibrationState == 5) {
            playTones(mouthWidth, mouthHeight, faceWidthPercentage);
        }
    } else {
        console.log("you have no face.");
    }

    requestAnimationFrame(processFrame);
}

async function playTones(mouthWidth, mouthHeight) {
    const now = Tone.now();

    let totalWIdthNotes = WIDTH_TABLE.length;
    let totalHeightNotes = HEIGHT_TABLE.length;
    let firstPart = WIDTH_TABLE[Math.floor(mouthWidth * totalWIdthNotes)];
    let secondPart = HEIGHT_TABLE[Math.floor(mouthHeight * totalHeightNotes)];

    let note = firstPart + secondPart;
    console.log("Playing note: " + note);
    synth.triggerAttack(note, now);
}
async function playMorse(mouthWidth, mouthHeight) {
    
}

var calibrationState = 1;

async function calibrate() {
    if (latestLandmarks == null) {
        setMessage("Cannot calibrate until a face is detected.");
    } else if (calibrationState == 0) {
        setMouthSize(20, 10);
        calibrationState = 1;
    } else if (calibrationState == 1) {
        mouthCalibration.faceWidth = getFaceWidth(latestLandmarks);
        setMouthSize(2, 2);
        setCalibrateButtonText("👍");
        calibrationState = 2;
    } else if (calibrationState == 2) {
        mouthCalibration.minWidth = getWidth(latestLandmarks);
        setMouthSize(50, 5);
        calibrationState = 3;
    } else if (calibrationState == 3) {
        mouthCalibration.maxWidth = getWidth(latestLandmarks);
        setMouthSize(2, 25);
        calibrationState = 4;
    } else if (calibrationState == 4) {
        mouthCalibration.minHeight = getHeight(latestLandmarks);
        setMouthSize(50, 5);
        calibrationState = 5;
    } else if (calibrationState == 5) {
        mouthCalibration.maxHeight = getHeight(latestLandmarks);
        setMouthSize(20, 10);
        setCalibrateButtonText("↩️");
        calibrationState = 0;
        hideCalibration();
    }
}

document.querySelector("button")?.addEventListener("click", async () => {
    await Tone.start();
    console.log("audio is ready");
});

document.body.onload = async (event) => {
    await setup();
};

webcamVideoElement.oncanplay = (event) => {
    processFrame();
};
