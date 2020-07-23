import { Record } from '../interfaces';

export function normalizeWithParent(
    data: Record[],
    parentData: Record[],
    measures: string[],
    syncScale: boolean
): {
    normalizedData: Record[];
    normalizedParentData: Record[];
} {
    const totalMeasuresOfParent: Record = {};
    const totalMeasures: Record = {};
    measures.forEach(mea => {
        totalMeasuresOfParent[mea] = 0;
        totalMeasures[mea] = 0;
    })
    parentData.forEach(record => {
        measures.forEach(mea => {
            totalMeasuresOfParent[mea] += Math.abs(record[mea])
        })
    })
    data.forEach(record => {
        measures.forEach(mea => {
            totalMeasures[mea] += Math.abs(record[mea]);
        })
    })
    const normalizedParentData: Record[] = [];
    parentData.forEach(record => {
        const newRecord = { ...record };
        measures.forEach(mea => {
            newRecord[mea] /= totalMeasuresOfParent[mea];
        })
        normalizedParentData.push(newRecord);
    })
    const normalizedData: Record[] = [];
    data.forEach(record => {
        const newRecord = { ...record };
        measures.forEach(mea => {
            if (syncScale) {
                newRecord[mea] /= totalMeasuresOfParent[mea];
            } else {
                newRecord[mea] /= totalMeasures[mea]
            }
        })
        normalizedData.push(newRecord);
    })
    return {
        normalizedData,
        normalizedParentData
    };
}

export function compareDistribution (distribution1: Record[], distribution2: Record[], dimensions: string[], measures: string[]): number {
    let score = 0;
    const tagsForD2: boolean[] = distribution2.map(() => false);
    for (let record of distribution1) {
        let targetRecordIndex = distribution2.findIndex((r, i) => {
            return !tagsForD2[i] && dimensions.every(dim => r[dim] === record[dim])
        })
        if (targetRecordIndex > -1) {
            tagsForD2[targetRecordIndex] = true;
            const targetRecord = distribution2[targetRecordIndex];
            for (let mea of measures) {
                score += Math.abs(targetRecord[mea] - record[mea]);
            }
        } else {
            for (let mea of measures) {
                score += Math.abs(record[mea])
            }
        }
    }
    for (let i = 0; i < distribution2.length; i++) {
        if (!tagsForD2[i]) {
            tagsForD2[i] = true;
            for (let mea of measures) {
                score += Math.abs(distribution2[i][mea])
            }
        }
    }
    return score;
}
