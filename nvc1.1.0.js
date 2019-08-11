const { execFileSync } = require('child_process');
const { execSync } = require('child_process');

const nvidiaSMI = 'C:/Program Files/NVIDIA Corporation/NVSMI/nvidia-smi';
const nvidiaInspector = 'C:/Users/Dad/Desktop/nvidiaInspector/nvidiainspector.exe';

const voltageUpdateInterval = 2 * 1000; // update every N seconds
const voltageStep = 6250; // voltage changes applied in steps

// the following values are set per GPU

const devices = [0, 1, 2, 3, 4, 5, 6]; // list of GPU indexes to control, [N = 0, N+, , , ,  max or any combination], empty = all

//Voltage Controller via Temperature
const minVoltage = [762000, 743000, 762000, 750000, 750000, 775000, 762000];
const maxVoltage = [880000, 850000, 875000, 875000, 875000, 875000, 875000];
const startVoltage = [850000, 850000, 850000, 850000, 850000, 850000, 850000];
const targetTemperature = [63, 63, 63, 63, 63, 63, 63];

//Rig Restarters - FailSafes and Limit switches
const maxTemperature = [80, 80, 80, 80, 80, 80, 80]; //Max Temperature will Restart OS
const maxPowerDraw = [300, 300, 300, 300, 300, 300, 300]; //Max Power Draw will Restart OS
const minPowerDraw = [150, 150, 150, 150, 150, 150, 150]; //Min Power Draw will Restart OS

//Hashrate Maximization Parameters
const targetPowerDraw = [280, 280, 280, 280, 280, 280, 280]; // PowerDraw Prefered
const baseClockOffset = [170, 170, 130, 140, 170, 180, 130]; // baseclockoffset Prefered
const memoryClockOffset = [220, 460, 460, 460, 300, 460, 450]; // memoryclockoffset Prefered
const clockOffsetTimeout = 10 * 60 * 1000; // apply base/memory clock offset after 10 minutes

const Kp = 0.3; // proportional coefficient for voltage control (Kp value = step / 1 degree)

function query(field, transform) {
    const result = [];
    const output = execFileSync(nvidiaSMI, [`--query-gpu=index,${field}`, '--format=csv,noheader']);
    output.toString('ascii')
        .split(/\r?\n/)
        .filter(line => line.length > 0)
        .forEach(line => {
            const [index, value] = line.split(/,\s+/);
            result[parseInt(index)] = transform ? transform(value) : value;
        });
    return result;
}

function apply(args) {
    if (args.length === 0) {
        return;
    }
    console.log('nvidiaInspector', args.join(' '));
    execFileSync(nvidiaInspector, args);
}

function reboot() {
    // Windows only
    execSync('shutdown /r');
}

function listGPU() {
    return query('index', index => parseInt(index));
}

function getTemperatures() {
    return query('temperature.gpu', temperature => parseInt(temperature));
}

function setVoltage(gpus, microVolts) {
    const args = [];
    gpus.forEach((gpuIndex, i) => {
        const uV = microVolts[i] || microVolts[0];
        if (uV) {
            args.push(`-lockVoltagePoint:${gpuIndex},${uV.toFixed(0)}`);
        }
    });
    apply(args);
}

function getPowerDraws() {
    return query('power.draw', powerdraw => parseInt(powerdraw));
}

function setClockOffset(gpus, baseClockOffset, memoryClockOffset) {
    const args = [];
    gpus.forEach((gpuIndex, i) => {
        const baseOffset = baseClockOffset[i] || baseClockOffset[0];
        if (baseOffset) {
            args.push(`-setBaseClockOffset:${gpuIndex},0,${baseOffset}`); // pstateld=0
        }
        const memOffset = memoryClockOffset[i] || memoryClockOffset[0];
        if (memOffset) {
            args.push(`-setMemoryClockOffset:${gpuIndex},0,${memOffset}`);
        }
    });
    apply(args);
}

const gpus = listGPU()
    .filter((_, i) => (devices.length === 0) || devices.includes(i));

if (gpus.length === 0) {
    console.error('No GPU available');
    process.exit(1);
}

setTimeout(() => {
    setClockOffset(gpus, baseClockOffset, memoryClockOffset);
}, clockOffsetTimeout);

let currentVoltage = [];

function roundVoltageToStep(uV) {
    return voltageStep * Math.round(uV / voltageStep);
}

function updateVoltage() {

    const temperatures = getTemperatures()
        .filter((_, i) => (devices.length === 0) || devices.includes(i));

    if (temperatures.length === 0) {
        return; // no devices, just in case
    }

    const maxTemperatureReached = (temperatures.findIndex((currentTemperature, i) => currentTemperature >= (maxTemperature[i] || maxTemperature[0])) >= 0);
    if (maxTemperatureReached) {
        console.log('Maximum temperature reached');
        reboot();
        return;
    }
	
	const PowerDraws = getPowerDraws()
        .filter((_, i) => (devices.length === 0) || devices.includes(i));

    if (PowerDraws.length === 0) {
        return; // no devices, just in case
    }

	const minPowerDrawReached = (PowerDraws.findIndex((currentPowerDraw, i) => currentPowerDraw <= (minPowerDraw[i] || minPowerDraw[0])) >= 0);
    if (minPowerDrawReached) {
        console.log('Minimum PowerDraw reached');
        reboot();
        return;
    }

	const maxPowerDrawReached = (PowerDraws.findIndex((currentPowerDraw, i) => currentPowerDraw >= (maxPowerDraw[i] || maxPowerDraw[0])) >= 0);
    if (minPowerDrawReached) {
        console.log('Maximum PowerDraw reached');
        reboot();
        return;
    }

	const currentPowerDraw = PowerDraws
	
    if (currentVoltage.length === 0) {
        // First time
        currentVoltage = gpus.map((_, i) => roundVoltageToStep(startVoltage[i] || startVoltage[0]));
        setVoltage(gpus, currentVoltage);
    } else {
        const newVoltage = gpus.map((gpuIndex, i) => {
            const currentTemperature = temperatures[i];
            const dT = (targetTemperature[i] || targetTemperature[0]) - currentTemperature;
            const dV = Math.round(dT * Kp * voltageStep);
            const newV = Math.min(Math.max(currentVoltage[i] + dV, minVoltage[i] || minVoltage[0]), maxVoltage[i] || maxVoltage[0]);
            console.log(`#${gpuIndex}: T = ${currentTemperature}, Vcurr = ${currentVoltage[i]} uV, dT = ${dT.toString().padStart(2)}, dV = ${dV.toString().padStart(5)}, Vnew = ${newV} uV, curr_Pwr = ${PowerDraws} W`);
            return newV;
        });
        const changed = (newVoltage.findIndex((newV, i) => roundVoltageToStep(newV) !== roundVoltageToStep(currentVoltage[i])) >= 0);
        if (changed) {
            setVoltage(gpus, newVoltage.map(newV => roundVoltageToStep(newV)));
        }

        currentVoltage = newVoltage;
    }
	
    setTimeout(updateVoltage, voltageUpdateInterval);
}

updateVoltage();
