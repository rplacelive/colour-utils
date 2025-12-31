// definitely not ripped from Gamma
const a = document.createElement('a')
export const download = (file, name = file.name ?? (file.type[0]=='@' ? 'file' : file.type.split('/',1)[0])) => {
	a.href = URL.createObjectURL(file)
	a.download = name
	a.click()
	URL.revokeObjectURL(a.href)
}

export function stringToIntColor(a){
	if(a[0]=='#'){
		let v = parseInt(a = a.slice(1), 16)|0
		let alpha = 255
		switch(a.length){
			case 4:
				alpha = v&15
				alpha |= alpha<<4
				v >>= 4
			case 3:
				const b = v&15, g = v>>4&15, r = v>>8&15
				v = r|r<<4|g<<8|g<<12|b<<16|b<<20
				break
			case 8:
				alpha = v&255
				v >>>= 8
			case 6:
				v = v>>16&0xff|v&(0xff<<8)|(v&0xff)<<16
				break
			default: return 0
		}
		return v|alpha<<24
	}
	return parseInt(a)|0
}
const hex = '0123456789ABCDEF'
export function intColorToString(col){
	const r = col&0xff, g = col>>8&0xff, b = col>>16&0xff, a = col>>24&0xff
	if((col&0x0F0F0F0F) == (col>>4&0x0F0F0F0F)){
		return '#'+hex[r&15]+hex[g&15]+hex[b&15] + (a == 255 ? '' : hex[a&15])
	}
	return '#'+hex[r>>4]+hex[r&15]+hex[g>>4]+hex[g&15]+hex[b>>4]+hex[b&15] + (a == 255 ? '' : hex[a>>4]+hex[a&15])
}

export function bswap(int){
	int = int<<16|int>>>16
	return int>>8&0x00FF00FF|int<<8&0xFF00FF00
}

function getDifference(ref, r1, g1, b1, a1 = 255){
	const a2 = (ref >> 24) & 0xff
	const b2 = (ref >> 16) & 0xff
	const g2 = (ref >> 8) & 0xff
	const r2 = ref & 0xff
	return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2)

}
const MAX_DIFFERENCE = 255 * 4

const canvas = document.createElement("canvas")
const ctx = canvas.getContext("2d")

/**
 * 
 * @param {File} imageFile
 * @param {number} margin Between 0 and 1
 * @returns {Promise<string[]>}
 */
export async function image2Palette(imageFile, margin = 0){
	margin *= MAX_DIFFERENCE
	const bmp = await createImageBitmap(imageFile)
	canvas.width = bmp.width
	canvas.height = bmp.height
	ctx.drawImage(bmp, 0, 0)
	bmp.close()
	const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
	const colors = []

	for(let i = 0; i < data.length; i += 4){
		const r = data[i], g = data[i|1], b = data[i|2], a = data[i|3]
		// TODO: this is order-dependent and generally incorrect
		if(!colors.some(c => getDifference(c, r, g, b, a) <= margin))
			colors.push(r|g<<8|b<<16|a<<24)
	}

	// Convert colors to hex format
	return colors.map(intColorToString)
}

/**
 * @param {File} canvasFile,
 * @param {{ width: number, height: number, palette: Array<number> }} metadata
 */
export async function canvasFile2Image(canvasFile, metadata, format="image/png"){
	const arrayBuffer = await canvasFile.arrayBuffer()
	const imageURL = await boardToPng(arrayBuffer, metadata, format)
	return imageURL
}

/**
 * @param {File} imageFile,
 * @param {Array<number>} palette
 * @returns {Uint8Array}
 */
export async function imageFile2Canvas(bmp, palette, width = 0, height = 0){
	if(!(bmp instanceof ImageBitmap))
		bmp = await createImageBitmap(imageFile)
	
	if(!width){
		if(!height){
			width = bmp.width
			height = bmp.height
		}
		width = Math.round(bmp.width/bmp.height*height)||1
	}else if(!height){
		height = Math.round(bmp.height/bmp.width*width)||1
	}
	canvas.width = width
	canvas.height = height
	ctx.drawImage(bmp, 0, 0, width, height)
	bmp.close()
	const { data } = ctx.getImageData(0, 0, width, height)
	const byteArray = new Uint8Array(width * height)
	for(let i = 0; i < data.length; i += 4){
		let bestColor = 0, bestSimilarity = MAX_DIFFERENCE+1
		const r = data[i], g = data[i|1], b = data[i|2], a = data[i|3]
		let colorIndex = 0
		for(const color of palette){
			const diff = getDifference(color, r, g, b, a)
			if(diff < bestSimilarity){
				bestSimilarity = diff
				bestColor = colorIndex
			}
			colorIndex++
		}
		byteArray[i>>2] = bestColor
	}
	return byteArray
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @param {{ width: number, height: number, palette: Array<number> }} metadata
 * @param {string} format
 * @returns {Promise<File>}
 */
export function boardToPng(arrayBuffer, metadata, format = "image/png"){
	const { palette, width, height } = metadata
	canvas.width = width
	canvas.height = height
	const imageData = ctx.createImageData(width, height)
	const { data } = imageData
	const board = new Uint8Array(arrayBuffer)

	for (let i = 0; i < board.byteLength; i++){
		const color = palette[board[i]]
		// palette is in 0xRRGGBBAA format 🥀
		const r = (color >> 24) & 0xFF
		const g = (color >> 16) & 0xFF
		const b = (color >> 8) & 0xFF

		const idx = i<<2
		data[idx] = r
		data[idx|1] = g
		data[idx|2] = b
		data[idx|3] = 255
	}
	ctx.putImageData(imageData, 0, 0)
	return new Promise(resolve => canvas.toBlob(resolve, format))
}