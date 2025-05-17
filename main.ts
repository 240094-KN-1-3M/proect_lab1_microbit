
let ioInfo = {
    SB1: DigitalPin.P5, 
    SB2: DigitalPin.P11,
    LEa: DigitalPin.P13, 
    LEb: DigitalPin.P14, 
    QE: AnalogPin.P0,
    XV1: DigitalPin.P8, 
    CV2: AnalogPin.P1,
    CV3: AnalogPin.P2,
    XV4: DigitalPin.P9,
    KM1: DigitalPin.P15,
};



class Tank {
    private level = 0;
    constructor() { }

    getLevel(): number {
        return this.level;
    }

    addLiquid(speed: number): void {
        const randomFactor = 1 + Math.random() * 10;
        const increment = speed + randomFactor;
        const newLevel = this.level + Math.floor(20 * (increment / 100));
        this.level = newLevel > 100 ? 100 : newLevel;
    }

    drain() {
        this.level = Math.max(this.level - 35, 0);
    }
}


enum states { init, idle, load1, mix, load2, waitingConcentration, dwnld };


let isStarted = false;
// const timeoutMs = ((3 * 60) + 15) * 1000/1000; // 3хв.15с
const timeoutMs = ((3 * 60) + 15); // для тестування
let timer = 0;

let tank = new Tank();

let state = states.init;
serial.writeLine('Program started');



basic.forever(() => {
    let SB1 = (pins.digitalReadPin(ioInfo.SB1) === 1) || input.buttonIsPressed(Button.A);
    let SB2 = (pins.digitalReadPin(ioInfo.SB2) === 1) || input.buttonIsPressed(Button.B);
    let LEa = pins.digitalReadPin(ioInfo.LEa);
    let LEb = pins.digitalReadPin(ioInfo.LEb);
    let QE = pins.analogReadPin(ioInfo.QE);
    let XV1 = pins.digitalReadPin(ioInfo.XV1);
    let CV2 = pins.analogReadPin(ioInfo.CV2);
    let CV3 = pins.analogReadPin(ioInfo.CV3);
    let XV4 = pins.digitalReadPin(ioInfo.XV4);
    let KM1 = pins.digitalReadPin(ioInfo.KM1);

    if (SB1) { state = states.idle; isStarted = true }
    if (SB2) { isStarted = false }

    switch (state) {
        case states.init:
            pins.digitalWritePin(ioInfo.LEa, 0);
            pins.digitalWritePin(ioInfo.LEb, 0);
            pins.analogWritePin(ioInfo.QE, 0);
            pins.digitalWritePin(ioInfo.XV1, 0);
            pins.analogWritePin(ioInfo.CV2, 0);
            pins.analogWritePin(ioInfo.CV3, 0);
            pins.digitalWritePin(ioInfo.XV4, 0);
            pins.digitalWritePin(ioInfo.KM1, 0);
            break;

        case states.idle:
            pins.digitalWritePin(ioInfo.XV4, 0);
            state = states.load1;
            timer = 0;
            break;

        case states.load1:
            pins.digitalWritePin(ioInfo.XV1, 1);
            pins.digitalWritePin(ioInfo.LEb, 1);
            tank.addLiquid(20);

            serial.writeLine(`Loading 1`);
            serial.writeValue("tank level %", tank.getLevel());
            serial.writeValue("timer", timer);

            if (LEa === 1) {
                pins.digitalWritePin(ioInfo.XV1, 0);
                state = states.mix;
            }
            
            if (tank.getLevel() >= 70) pins.digitalWritePin(ioInfo.LEa, 1);
            break;

        case states.mix:
            pins.digitalWritePin(ioInfo.KM1, 1);
            serial.writeLine('Mixing')
            serial.writeValue("timer", timer);
            state = states.load2;
            break;

        case states.load2:
            pins.analogWritePin(ioInfo.CV2, 40);
            let msg = `Loading 2`;
            serial.writeLine(msg);
            serial.writeValue("tank level %", tank.getLevel());
            
            if (QE < 100 && timer > timeoutMs) {
                pins.analogWritePin(ioInfo.CV3, 10);
                msg = `Additional Loading 3`
                serial.writeLine(msg)
                serial.writeValue("tank level %", tank.getLevel());
            }
            tank.addLiquid(pins.analogReadPin(ioInfo.CV2) + pins.analogReadPin(ioInfo.CV3));
            timer += 200;
            serial.writeValue("timer", timer);
            state = states.waitingConcentration;
            break;

        case states.waitingConcentration:
            serial.writeLine('Waiting concentration');
            timer += 200;
            serial.writeValue("timer", timer);
            pins.analogWritePin(ioInfo.QE, tank.getLevel());

            if (QE === 100) { state = states.dwnld }
            else { state = states.load2 }
            break;

        case states.dwnld:
            pins.digitalWritePin(ioInfo.KM1, 0);
            pins.digitalWritePin(ioInfo.XV4, 1);
            serial.writeLine(`Downloading...`);
            serial.writeValue("tank level %", tank.getLevel());
            serial.writeValue("timer", timer);
            tank.drain();
            if (tank.getLevel() <= 70) pins.digitalWritePin(ioInfo.LEa, 0);
            if (tank.getLevel() === 0) pins.digitalWritePin(ioInfo.LEb, 0);


            if (LEb === 0) {
                pins.analogWritePin(ioInfo.QE, 0);
                if (isStarted) {
                    state = states.idle;
                    serial.writeLine('Next cycle')
                    serial.writeValue("timer", timer);
                } else {
                    state = states.init;
                    serial.writeLine('Program stopped')
                }
            }
            break;
        default:
            state = states.init;
    }

    basic.pause(200);
})
