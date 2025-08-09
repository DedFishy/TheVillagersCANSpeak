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
const languageSelect = document.getElementById("language-select");

const synth = new Tone.Synth().toDestination();

const languages = {
    "🎵": playTones,
    "📻": playMorseCode,
    "✈️": playAudioToVolume("jet2holiday.mp3"),
    "🦗": playAudioToVolume("crickets.mp3"),
    "🛻": playAudioToVolume("bergentruckung.mp3"),
    "🍔": playAudioToVolume("eating.mp3"),
    "🏈": playAudioToVolume("nfl.mp3"),
    "💥": playAudioWhenMouthAgape("vine-boom.mp3"),
    "⚠️": playAudioWhenMouthAgape("error.mp3"),
    "🔊": playAudioWhenMouthAgape("augh.mp3"),
    "❌": playAudioWhenMouthAgape("incorrect.mp3"),
};

var opened = false;
var last_opened = Date.now();
var last_closed = Date.now();

var lastMouthHeight = 0; // For calculating deltas
var lowDeltaCount = 0;

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

async function populateLanguages() {
    languageSelect.innerHTMl = "";
    Object.keys(languages).forEach((value, index, array) => {
        const optionEl = document.createElement("option");
        optionEl.value = value;
        optionEl.innerText = value;
        languageSelect.appendChild(optionEl);
    });
}
async function getSelectedLanguage() {
    const language = languageSelect.options[languageSelect.selectedIndex].text;
    if (language != "🎵") synth.triggerRelease(Tone.now());
    return languages[language];
}

async function updateLoaderTitle(title) {
    loaderTitle.innerText = title;
}
async function hideLoader() {
    loaderBody.classList.add("hidden");
}

async function setMouthSize(width, height) {
    calibrationMouthView.style.width = width + "%";
    calibrationMouthView.style.height = height + "%";
    calibrationMouthView.style.left = 50 - width / 2 + "%";
    calibrationMouthView.style.top = 68 - height / 2 + "%";
}

async function setup() {
    await populateLanguages();
    await setMouthSize(20, 7);

    updateLoaderTitle("⏳🌐");
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL);

    updateLoaderTitle("⏳📍");
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);

    updateLoaderTitle("📷🙏");
    await getWebcam();

    if (gotWebcam) {
        hideLoader();
    } else {
        updateLoaderTitle("📷❌");
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
    return clamp(
        ((getWidth(positions) - mouthCalibration.minWidth) /
            mouthCalibration.maxWidth) *
            (1 - faceWidthPercent)
    );
}

function getHeight(positions) {
    return positions[landmarks.mouthTop].y - positions[landmarks.mouthBottom].y;
}
function getHeightPercentage(positions, faceWidthPercent) {
    return clamp(
        ((getHeight(positions) - mouthCalibration.minHeight) /
            mouthCalibration.maxHeight) *
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

    latestLandmarks = null;
    if (faces.length > 0) {
        webcamVideoElement.style.borderColor = "green";
        const positions = faces[0].landmarks.positions;
        const faceWidthPercentage = getFaceWidthPercent(positions);
        var mouthWidth = getWidthPercentage(positions, faceWidthPercentage);
        var mouthHeight = getHeightPercentage(positions, faceWidthPercentage);
        mouthBox.style.width = Math.round(mouthWidth * 100) + "%";
        mouthBox.style.height = Math.round(mouthHeight * 100) + "%";
        latestLandmarks = positions;
        if (calibrationComplete && document.hasFocus()) {
            (await getSelectedLanguage())(
                mouthWidth,
                mouthHeight,
                faceWidthPercentage
            );
        }
    } else {
        webcamVideoElement.style.borderColor = "red";
        synth.triggerRelease(Tone.now());
        console.log("you have no face.");
    }

    requestAnimationFrame(processFrame);
}

document.onblur = async (event) => {
    synth.triggerRelease(Tone.now());
};

async function playTones(mouthWidth, mouthHeight, faceWidthPercentage) {
    const now = Tone.now();

    let totalWIdthNotes = WIDTH_TABLE.length;
    let totalHeightNotes = HEIGHT_TABLE.length;
    let firstPart = WIDTH_TABLE[Math.floor(mouthWidth * totalWIdthNotes)];
    let secondPart = HEIGHT_TABLE[Math.floor(mouthHeight * totalHeightNotes)];

    let note = firstPart + secondPart;
    console.log("Playing note: " + note);
    synth.triggerAttack(note, now);
}

async function playMorseCode(mouthWidth, mouthHeight, faceWidthPercentage) {
    if (mouthHeight > 0.3) {
        if (!opened) {
            last_opened = Date.now();
            opened = true;
            console.log("Mouth opened at " + last_opened);
        }
    } else if (mouthHeight <= 0.3) {
        if (opened) {
            last_closed = Date.now();
            opened = false;
            const duration = last_closed - last_opened;
            if (duration < 500) {
                playMorse(true);
            } else {
                playMorse(false);
            }
        }
    }
}

function playAudioToVolume(file) {
    const audio = new Audio(file);
    audio.volume = 0;
    audio.loop = true;
    audio.pause();
    languageSelect.addEventListener("click", (event) => {
        console.log("Pausing audio for " + file);
        audio.pause();
    });
    return async (mouthWidth, mouthHeight, faceWidthPercentage) => {
        var volume = mouthHeight;
        var delta = lastMouthHeight - volume;
        var deltaLow = delta < 0.1;
        if (deltaLow) lowDeltaCount++;
        else lowDeltaCount = 0;
        lastMouthHeight = volume;
        if (volume < 0.2 && lowDeltaCount > 4) audio.pause();
        else if (audio.paused) audio.play();
        volume *= 5;
        audio.volume = clamp(volume);

        var speed = mouthWidth + 0.8;
        audio.playbackRate = speed;
    };
}

function playAudioWhenMouthAgape(file) {
    const audio = new Audio(file);
    languageSelect.onchange = (event) => {
        audio.pause();
    };
    return async (mouthWidth, mouthHeight, faceWidthPercentage) => {
        if (mouthHeight > 0.5 && audio.paused) {
            audio.currentTime = 0;
            audio.play();
        } else if (mouthHeight <= 0.5 && !audio.paused) audio.pause();
    };
}

function playMorse(short) {
    const now = Tone.now();
    const morseCode = short ? "short" : "long";
    console.log("Playing morse code: " + morseCode);

    if (short) {
        synth.triggerAttackRelease("C4", 0.1, now);
    } else {
        synth.triggerAttackRelease("C5", 0.3, now);
    }
}

var calibrationState = DEBUG ? 5 : 1;
var calibrationComplete = DEBUG;

async function calibrate() {
    calibrateBtn.style.backgroundColor = "";
    if (latestLandmarks == null) {
        console.log("No face detected");
        calibrateBtn.style.backgroundColor = "red";
        setTimeout(() => {
            calibrateBtn.style.backgroundColor = "";
        }, 500);
    } else if (calibrationState == 0) {
        setMouthSize(20, 10);
        calibrationState = 1;
    } else if (calibrationState == 1) {
        mouthCalibration.faceWidth = getFaceWidth(latestLandmarks);
        setMouthSize(5, 5);
        calibrationMouthView.style.borderRadius = "100%";
        calibrationState = 2;
    } else if (calibrationState == 2) {
        mouthCalibration.minWidth = getWidth(latestLandmarks);
        setMouthSize(25, 10);
        calibrationState = 3;
    } else if (calibrationState == 3) {
        mouthCalibration.maxWidth = getWidth(latestLandmarks);
        setMouthSize(7, 20);
        calibrationState = 4;
    } else if (calibrationState == 4) {
        mouthCalibration.minHeight = getHeight(latestLandmarks);
        setMouthSize(20, 7);
        calibrationState = 5;
    } else if (calibrationState == 5) {
        mouthCalibration.maxHeight = getHeight(latestLandmarks);
        calibrationState = 0;
        hideCalibration();
        calibrationComplete = true;
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
