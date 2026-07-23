// Trigger a browser download for a base64 data-URL returned by the API.
export function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Read a File object into a base64 data-URL (for uploads). Rejects files over maxMB.
export function fileToDataUrl(file, maxMB = 5) {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) { reject(new Error(`File must be under ${maxMB} MB`)); return; }
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, name: file.name, type: file.type });
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
