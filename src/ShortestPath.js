/**
 * @module ShortestPath
 * @private
 */

/*eslint-disable*/
import { fillArray } from './Array.fill'

let prevTime = Date.now()

/**
 * @private
 * @todo tidy code
 * @todo implement faster algorithm (SMAWK)
 */
function getBestFit(tokens, spaceSize, offsets, width, height, fontSize, lineHeight, maxTokenSize, maxLineHeight, minLineHeight, truncatedToken, truncatedTokenSize, context) {
    let currentTime = Date.now()
    prevTime = currentTime
    const count = tokens.length
    let maxLines

    // heightRatio is how many times the unscaled fontsize * desired line height fit into the height of the box.
    let heightRatio = height/(fontSize*lineHeight)
    
    // Use the maxTokenSize and maxLineHeight to caclulate the minimum lines
    let lines

    /**
     * If a max font size is set, then we must have a minimum number of lines,
     * any less than this minimum will result in text being too large.
     * Sometimes these minimum lines will not fit into available height evenly,
     * most of the algorithm work on the bases of available height divided evenly 
     * between the target lines.
     * The maxLineHeightQuotient is used later to calculate the scaledwidth using
     * a remainder of the minLines calculation diretly below, while the rest of the algorithm
     * uses the floored value of this.
     * This is only used at the first pass of findMinima, after that it continues as normal
     * with even line division.
     */
    let maxLineHeightQuotient

    lines = Math.ceil(maxTokenSize * heightRatio / width)

    if (maxLineHeight > 0) {
        maxLineHeightQuotient = height / maxLineHeight
        const maxLineHeightLines = Math.floor(maxLineHeightQuotient)
        lines = Math.max(lines, maxLineHeightLines)
    }

    if (minLineHeight > 0) {
        maxLines = Math.floor(height/ minLineHeight)
    }

    // figure out minimum lines
    // should implement a binary search for this
    let i = lines
    let finished = false
    let previousBreakpoint
    while (!finished) {
        let maxSpace = width/heightRatio * i * i
        for (let j = previousBreakpoint || 0; j < count+1; j++) {
            if (offsets[j] + (j + i - 1) * spaceSize > maxSpace) {
                let needsNewLine = false
                let newMaxSpace = width/heightRatio * (i + 1) * i // scale width as if new line, but don't actually use an i + 1 th line
                for (let k = j+1; k < count+1; k++) {
                    if (offsets[k] + ( k + i - 1) * spaceSize > newMaxSpace) {
                        needsNewLine = true
                        previousBreakpoint = k - 1 // shouldn't find the breakpoint earlier than this
                        break
                    }
                }
                if (!needsNewLine) {
                    // we have min
                    finished = true // finish the while
                    break // from the for, not the while
                } else {
                    // we need moar lines
                    i++
                }
                break // from the for, not the while
            } else if (j === count) {
                // from the for, and end while
                finished = true
                break
            }
        }
    }

    let minLines = i

    // make sure min lines isn't greater than max lines
    if (maxLines) {
        if (minLines > maxLines) {
            minLines = maxLines
        }
    }

    let largestLineSize

    function truncateLine(line) {
        let lineOffsets = new Array(line.length + 1)
        lineOffsets[0] = 0

        for (let i = 0; i < line.length; i++) {
            lineOffsets[i + 1] = context.measureText(line.slice(0, i)).width
        }

        let j
        for (j = lineOffsets.length; j > 0; j--) {
            if ((lineOffsets[j] + truncatedTokenSize + spaceSize) < largestLineSize) {
                let newLineSize = context.measureText(line.slice(0, j - 1) + truncatedToken).width;
                if (newLineSize + 1 < largestLineSize) { // + 1 to avoid rounding errors
                    break;
                }
            }
        }

        return line.slice(0, j - 1) + truncatedToken
    }

    function calcWidth(i, j) {
        return offsets[j] - offsets[i] + 1 + (j - i - 1) * spaceSize // there is a plus one to avoid rounding errors
    }

    function findMinima(scaledWidth, targetLines) {
        let minima = [0].concat(fillArray(Array(count), Infinity))
        let breaks = fillArray(Array(count + 1), 0)

        largestLineSize = 0
        for (let i = 0; i < count; i++) {
            let j = i + 1
            while (j <= count) {
                let w = calcWidth(i, j)
                if (w > scaledWidth) {
                    break
                }

                let cost = minima[i] + Math.pow((scaledWidth - w), 2)

                if (cost < minima[j]) {
                    minima[j] = cost
                    breaks[j] = i
                }
                j += 1
            }
        }

        let lines = []
        let lineIndexes = []
        let j = count

        while (j > 0) {
            let i = breaks[j]
            if (lineIndexes.length + 1 > targetLines && (!maxLines || (maxLines > targetLines))) {
                return false
            } else {
                lineIndexes.push({ start: i, end: j })
            }
            let width = calcWidth(i, j)
            largestLineSize = Math.max(largestLineSize, width)
            j = i
        }

        const truncate = maxLines && (lineIndexes.length > maxLines) && (targetLines === maxLines)

        function countLinesFromBreaks (nextBreak) {
            let lineCount = 0

            while (nextBreak !== 0) {
                nextBreak = breaks[nextBreak]
                lineCount++
            }

            return lineCount
        }

        let currentStartingBreak = 0
        if (truncate) {
            // Need to find the break that fits the most words into the maxLines
            j = 0            
            for (let i = 0; i < breaks.length; i++) {
                if (i !== 0) {
                    let lineCount = countLinesFromBreaks(i)

                    if (lineCount === maxLines) {
                        currentStartingBreak = i
                    }

                    if (lineCount > maxLines) {
                        break
                    }
                }
            }
            
            lineIndexes = []
            j = currentStartingBreak
            let i = breaks[j]
            lineIndexes.push({ start: i, end: j + 1 })

            let width = calcWidth(i, j)
            largestLineSize = Math.max(largestLineSize, width)

            j = i
            // recalculate line indexes with truncated text
            while (j > 0) {
                let i = breaks[j]
                lineIndexes.push({ start: i, end: j })
                let width = calcWidth(i, j)
                largestLineSize = Math.max(largestLineSize, width)
                j = i
            }
        }

        for (let l = lineIndexes.length - 1; l >= 0; l--) {
            const lineIndex = lineIndexes[l]
            let line = tokens.slice(lineIndex.start, lineIndex.end).join(' ')
            if (l === 0 && truncate) {
                line = truncateLine(line)
            }
            lines.push({ line: line })
        }

        return lines
    }

    let currentLines = minLines
    let results
    let maxLineWidth
    let attempts = 0
    let trying = true

    const maxLineHeightQuotientFloor = Math.floor(maxLineHeightQuotient)
    let usedMaxLineHeight = false 
    while (trying) {
        maxLineWidth = currentLines * width/heightRatio            
        if (!usedMaxLineHeight) {
            if (Math.floor(maxLineHeightQuotient) === currentLines) {
                maxLineWidth = maxLineHeightQuotient * width/heightRatio
            }
        }

        results = findMinima(maxLineWidth, currentLines)

        if (attempts > 100) {
            throw new Error(`Can't fit text after ${attempts} attempts`);
        }
        attempts++

        if (!results) {
            if (!usedMaxLineHeight) {
                usedMaxLineHeight = true
            } else {
                currentLines++            
            }
        } else {
            trying = false
        }
    }
    return {
        results: results,
        targetLines: currentLines,
        maxLineWidth: maxLineWidth,
        largestLineSize: largestLineSize
    }
}

export { getBestFit }
