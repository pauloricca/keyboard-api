import { spawn } from 'node:child_process';

export async function renderPng(svg: string): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const child = spawn('rsvg-convert', ['--format=png'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(Buffer.concat(output));
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('PNG conversion timed out'));
    }, 10_000);
    child.stdout.on('data', chunk => output.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => errors.push(Buffer.from(chunk)));
    child.on('error', error => finish(error));
    child.on('close', code => {
      if (code === 0) finish();
      else finish(new Error(Buffer.concat(errors).toString('utf8').trim() || `rsvg-convert exited with code ${code}`));
    });
    child.stdin.on('error', error => finish(error));
    child.stdin.end(svg);
  });
}
