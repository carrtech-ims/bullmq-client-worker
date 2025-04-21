import './worker';

console.log('BullMQ worker started successfully.');
console.log('Waiting for jobs...');
console.log(`Logging every ${require('./config').default.worker.logEvery} jobs. You may have to wait to see an update.`);
