import { unzipSync, strFromU8 } from 'fflate'

export function decompressMxl(buffer) {
  const zip = unzipSync(new Uint8Array(buffer))
  const containerXml = zip['META-INF/container.xml']
  if (containerXml) {
    const doc = new DOMParser().parseFromString(strFromU8(containerXml), 'text/xml')
    const rootPath = doc.querySelector('rootfile')?.getAttribute('full-path')
    if (rootPath && zip[rootPath]) {
      return strFromU8(zip[rootPath])
    }
  }
  for (const name of Object.keys(zip)) {
    if (/\.musicxml$/i.test(name) || (/\.xml$/i.test(name) && name !== 'META-INF/container.xml')) {
      return strFromU8(zip[name])
    }
  }
  throw new Error('No MusicXML file found in .mxl archive')
}
