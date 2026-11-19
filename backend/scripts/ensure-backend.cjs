
const { spawn } = require('child_process');
const net = require('net');

const root = require('path').resolve(__dirname, '../..');
const backend = require('path').join(root, 'backend');
const port = 3000;

function isBackendRunning() {
    return new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(1000);

        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.once('error', () => resolve(false));
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, '127.0.0.1');
    });
}

async function main() {
    if (await isBackendRunning()) {
        console.log('Backend already running.');
        console.log('BACKEND_READY');
        setInterval(() => {}, 1000);
        return;
    }

    console.log('Starting Type and Run backend...');

    const isWindows = process.platform === 'win32';

    const child = spawn(
        isWindows ? 'npm.cmd' : 'npm',
        ['run', 'dev'],
        {
            cwd: backend,
            stdio: 'inherit',
            shell: isWindows
        }
    );

    child.on('error', error => {
        console.error('Backend startup error:', error);
        process.exit(1);
    });

    child.on('exit', code => {
        console.log(`Backend stopped with code ${code}`);
        process.exit(code || 0);
    });

    for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (await isBackendRunning()) {
            console.log('Backend is ready!');
            console.log('BACKEND_READY');
            return;
        }
    }

    console.error('Backend did not start on port 3000.');
    child.kill();
    process.exit(1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
