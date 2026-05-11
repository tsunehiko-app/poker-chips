// 混同しやすい文字(O, I, L)を除外したアルファベット
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}
