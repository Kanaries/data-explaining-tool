import { Insight } from 'visual-insights';
import { Record, IMeasure } from './interfaces';
import { checkMajorFactor, filterByPredicates, checkChildOutlier, IPredicate } from './utils';
import { normalizeWithParent, compareDistribution, normalizeByMeasures, getDistributionDifference } from './utils/normalization';
import { StatFuncName } from 'visual-insights/build/esm/statistics';
export interface IExplaination {
    dimensions: string[];
    measures: IMeasure[];
    extendDs: string[];
    extendMs: IMeasure[];
    type: string;
    score: number;
    description: any;
    predicates: IPredicate[];
}
export class DataExplainer {
    public dataSource: Record[];
    private dimensions: string[];
    private measures: string[];
    private engine: Insight.VIEngine;
    private defaultAggs: StatFuncName[] = ['min', 'max', 'sum', 'count', 'mean'];
    constructor (dataSource: Record[] = []) {
        this.engine = new Insight.VIEngine();
        this.dataSource = dataSource;
        this.dimensions = [];
        this.measures = [];
        let keys: string[] = [];
        if (dataSource.length > 0) {
            keys = Object.keys(dataSource[0]);
        }
        this.engine.setDataSource(dataSource)
            .setFieldKeys(keys)
            .buildfieldsSummary();
        // const newKeys = this.engine.fields.filter(f => f.domain.size < 40).map(f => f.key);
        // this.engine.setFieldKeys(keys);
        // const keys = Object.keys(dataSource[0])
    }
    public setDimensions (dimensions: string[]) {
        this.dimensions = dimensions;
        this.engine.setDimensions(dimensions);
        return this;
    }
    public setMeasures (measures: string[]) {
        this.measures = measures;
        this.engine.setMeasures(measures);
        return this;
    }
    public preAnalysis() {
        console.log('start')
        this.engine.buildGraph();
        this.engine.dataGraph.DIMENSION_CORRELATION_THRESHOLD = 0.6;
        this.engine.dataGraph.MEASURE_CORRELATION_THRESHOLD = 0.8;
        console.log('graph finish')
        this.engine
            .clusterFields();
        console.log('cluster finish')
        this.engine.buildSubspaces({
                MAX: 2,
                MIN: 1
            },
            {
                MAX: 2,
                MIN: 1
            }
            );
        console.log('subspaces finsh. start build-cube')
        this.engine.buildCube();
        console.log('cube finish')
        return this;
    }
    public explain (predicates: IPredicate[], dimensions: string[], measures: IMeasure[], ops: StatFuncName[], threshold: number = 0.2): IExplaination[] {
        // const predicates = getPredicates(selection, dimensions, measures);
        // 讨论：知道selection，但是分析的维度是什么？
        const selectAll = dimensions.length === 0 || predicates.length === 0;
        console.log({ selectAll })
        const dimSelectionSpaces = selectAll ? [] : this.explainBySelection(
            predicates,
            dimensions,
            measures,
            10
        );
        const meaSelectionSpaces = selectAll ? [] : this.explainByCorMeasures(
            predicates,
            dimensions,
            measures,
            5
        );
        const childrenSpaces = this.explainByChildren(
            [],
            dimensions,
            measures,
            10
        );
        const ansSpaces: IExplaination[] = [];
        dimSelectionSpaces.forEach((space) => {
            ansSpaces.push({
                dimensions,
                extendDs: space.dimensions,
                measures,
                extendMs: [],
                score: space.score,
                type: 'selection_dim_distribution',
                description: space,
                predicates
            });
        });
        meaSelectionSpaces.forEach((space) => {
            ansSpaces.push({
                dimensions: dimensions,
                extendDs: [],
                extendMs: space.measures,
                measures,
                score: space.score,
                type: 'selection_mea_distribution',
                description: space,
                predicates
            });
        });
        childrenSpaces.majorList.forEach((space) => {
            ansSpaces.push({
                dimensions,
                extendDs: space.dimensions,
                measures,
                extendMs: [],
                score: space.score,
                type: 'children_major_factor',
                description: space,
                predicates
            });
        });
        childrenSpaces.outlierList.forEach((space) => {
            ansSpaces.push({
                dimensions,
                extendDs: space.dimensions,
                measures,
                extendMs: [],
                score: space.score,
                type: 'children_outlier',
                description: space,
                predicates
            });
        });
        return ansSpaces.filter(space => space.score >= threshold);
    }
    public explainByChildren(predicates: IPredicate[], dimensions: string[], measures: IMeasure[], K_Neighbor: number = 3) {
        // 1. find most relative dimensions(topK)
        // 2. for each dimension, we check all the dim member in it. find the member whos distribution is most close to current one.
        // here we do not nomorlize all the dim member's distribution, we use the relative distribution instead.
        // 3. the dim member we found can be used to explain current one as major factor.
        // const predicates: IPredicate[] = selection === 'all' ? [] : getPredicates(selection, dimensions, []);
        // console.log(predicates)
        const parentCuboid = this.engine.cube.getCuboid(dimensions);
        const measureNames = measures.map(m => m.key);
        const ops = measures.map(m => m.op);
        const parentData = filterByPredicates(parentCuboid.getState(measureNames, ops), predicates);
        // console.log(parentData)
        const knn = this.getGeneralizeKNN('dimension', dimensions, K_Neighbor, 0);
        console.log('knn', knn)
        const majorList: Array<{key: string; score: number; dimensions: string[]; measures: IMeasure[]}> = [];
        const outlierList: Array<{key: string; score: number; dimensions: string[]; measures: IMeasure[]}> = [];
        for (let extendDim of knn) {
            const cuboid = this.engine.cube.getCuboid([...dimensions, extendDim]);
            const data = filterByPredicates(cuboid.getState(measureNames, ops), predicates);
            let groups: Map<any, Record[]> = new Map();
            for (let record of data) {
                if (!groups.has(record[extendDim])) {
                    groups.set(record[extendDim], [])
                }
                groups.get(record[extendDim])?.push(record)
            }
            const { majorKey, majorSum } = checkMajorFactor(parentData, groups, dimensions, measureNames)
            majorList.push({ key: majorKey, score: majorSum, dimensions: [extendDim], measures })
            const { outlierKey, outlierSum } = checkChildOutlier(parentData, groups, dimensions, measureNames);
            outlierList.push({ key: outlierKey, score: outlierSum, dimensions: [extendDim], measures })
        }
        majorList.sort((a, b) => a.score - b.score);
        outlierList.sort((a, b) => b.score - a.score);
        return {
            majorList,
            outlierList
        };
    }
    public explainBySelection(predicates: IPredicate[], dimensions: string[], measures: IMeasure[], K_Neighbor: number = 3) {
        // const predicates = getPredicates(selection, dimensions, []);
        // const parentCuboid = this.engine.cube.getCuboid()
        const measureNames = measures.map((m) => m.key);
        const ops = measures.map((m) => m.op);
        const knn = this.getGeneralizeKNN('dimension', dimensions, K_Neighbor, 0);
        const outlierList: Array<{ score: number; dimensions: string[]; measures: IMeasure[] }> = [];
        for (let extendDim of knn) {
            const parentCuboid = this.engine.cube.getCuboid([extendDim])
            const cuboid = this.engine.cube.getCuboid([...dimensions, extendDim])
            const overallData = parentCuboid.getState(measureNames, ops);
            const subData = filterByPredicates(cuboid.getState(measureNames, ops), predicates);

            let outlierNormalization = normalizeWithParent(subData, overallData, measureNames, false);

            let outlierScore = compareDistribution(
                outlierNormalization.normalizedData,
                outlierNormalization.normalizedParentData,
                [extendDim],
                measureNames
            );
            outlierScore /= (measures.length * 2)
            outlierList.push({
                dimensions: [extendDim],
                measures,
                score: outlierScore
            })
            // compare overall and subdata. set score. (major and outlier)
        }
        outlierList.sort((a, b) => b.score - a.score)
        return outlierList;
    }
    public explainByCorMeasures(predicates: IPredicate[], dimensions: string[], measures: IMeasure[], K_Neighbor: number = 3) {
        // const predicates = getPredicates(selection, dimensions, []);
        // const parentCuboid = this.engine.cube.getCuboid()
        const measureNames = measures.map((m) => m.key);
        const ops = measures.map((m) => m.op);
        const knn = this.getGeneralizeKNN('measure', measureNames, K_Neighbor);
        const allMeasureNames = [...measureNames, ...knn];
        // const ops: StatFuncName[] = allMeasures.map(() => 'sum');
        const ans: Array<{ score: number; dimensions: string[]; measures: IMeasure[]; max: number;  min: number }> = [];
        const cuboid = this.engine.cube.getCuboid(dimensions);
        for (let op of this.defaultAggs) {
            const extendMeasureOps = knn.map(() => op);
            const normalizedState = normalizeByMeasures(
                cuboid.getState(allMeasureNames, [...ops, ...extendMeasureOps]),
                allMeasureNames
            );
            for (let extendMea of allMeasureNames) {
                const originMeasure = measures.find(m => m.key === extendMea);
                if (originMeasure && originMeasure.op === op) continue;
                else if (originMeasure) {
                    const norStateWithNewOp = normalizeByMeasures(
                        cuboid.getState([extendMea], [op]),
                        [extendMea]
                    )
                    const mergedDataSource = normalizedState.map((record, rIndex) => {
                        return {
                            ...record,
                            [`__${extendMea}`]: norStateWithNewOp[rIndex][extendMea]
                        }
                    })
                    let maxDiff = 0;
                    let minDiff = 1;
                    for (let baseMeasure of measures) {
                        let diffScore =
                            getDistributionDifference(
                                mergedDataSource,
                                dimensions,
                                baseMeasure.key,
                                `__${extendMea}`
                            ) / 2;
                        maxDiff = Math.max(maxDiff, diffScore);
                        minDiff = Math.min(minDiff, diffScore);
                    }
                    ans.push({
                        dimensions,
                        score: Math.max(1 - minDiff, maxDiff),
                        measures: [{ key: extendMea, op }],
                        max: maxDiff,
                        min: minDiff,
                    });
                } else {
                    let maxDiff = 0;
                    let minDiff = 1;
                    for (let baseMeasure of measures) {
                        let diffScore =
                            getDistributionDifference(
                                normalizedState,
                                dimensions,
                                baseMeasure.key,
                                extendMea
                            ) / 2;
                        maxDiff = Math.max(maxDiff, diffScore);
                        minDiff = Math.min(minDiff, diffScore);
                    }
                    ans.push({
                        dimensions,
                        score: Math.max(1 - minDiff, maxDiff),
                        measures: [{ key: extendMea, op }],
                        max: maxDiff,
                        min: minDiff,
                    });
                }
                // compare overall and subdata. set score. (major and outlier)
            }
        }
        ans.sort((a, b) => b.score - a.score);
        return ans;
    }
    public getGeneralizeKNN(type: 'dimension' | 'measure', fields: string[], K_Neighbor: number = 3, threshold = 0) {
        if (fields.length === 0) return this.getCenterFields(type, K_Neighbor);
        return this.getKNN(type, fields, K_Neighbor, threshold);
    }
    public getKNN(type: 'dimension' | 'measure', fields: string[], K_Neighbor: number = 3, threshold = 0) {
        const adjMatrix = type === 'dimension' ? this.engine.dataGraph.DG : this.engine.dataGraph.MG;
        const graphFields = type === 'dimension' ? this.engine.dataGraph.dimensions : this.engine.dataGraph.measures;
        const fieldIndices = fields.map(field => {
            let index = graphFields.indexOf(field);
            return index;
        });
        const neighbors: Array<{dis: number, index: number, imp: number}> = [];
        for (let fieldIndex of fieldIndices) {
            for (let i = 0; i < adjMatrix[fieldIndex].length; i++) {
                if (!fieldIndices.includes(i)) {
                    const dis = Math.abs(adjMatrix[fieldIndex][i]);
                    const fieldKey = graphFields[i];
                    const tf = this.engine.fields.find(f => f.key === fieldKey);
                    if (dis >= threshold) {
                        neighbors.push({
                            dis,
                            index: i,
                            imp: tf?.domain.size || Infinity,
                        });
                    }
                }
            }
        }

        neighbors.sort((a, b) => b.dis / b.imp - a.dis / a.imp);
        return neighbors.slice(0, K_Neighbor).map(f => graphFields[f.index]);
    }
    public getCenterFields (type: 'dimension' | 'measure', num: number = 5): string[] {
        const adjMatrix = type === 'dimension' ? this.engine.dataGraph.DG : this.engine.dataGraph.MG;
        const graphFields = type === 'dimension' ? this.engine.dataGraph.dimensions : this.engine.dataGraph.measures;
        let fieldScores: Array<{field: string; score: number}> = adjMatrix.map((row, rIndex) => {
            return {
                field: graphFields[rIndex],
                score: row.reduce((total, current) => total + Math.abs(current), 0)
            }
        })
        fieldScores.sort((a, b) => b.score - a.score)
        return fieldScores.map(f => f.field).slice(0, num);
    }
    public getVisSpec (spaces: IExplaination[]) {
        const engine = this.engine;
        return spaces.map(space => {
            let visSpace: Insight.InsightSpace;
            const measureNames = space.measures.map(m => m.key);
            const extendMsNames = space.extendMs.map(m => m.key);
            if (space.type === 'children_major_factor' || space.type === 'children_outlier') {
                visSpace = {
                    dimensions: [...space.extendDs, ...space.dimensions],
                    measures: extendMsNames.length > 0 ? extendMsNames : measureNames,
                    significance: space.score,
                    score: space.score,
                    description: space.description,
                };
            } else {
                visSpace = {
                    dimensions: space.extendDs.length > 0 ? space.extendDs : space.dimensions,
                    measures: extendMsNames.length > 0 ? extendMsNames : measureNames,
                    significance: space.score,
                    score: space.score,
                    description: space.description,
                };
            }
            const allMeasures = [...space.measures, ...space.extendMs];
            return {
                schema: engine.specification(visSpace).schema,
                dataView: engine.cube.getCuboid([...space.dimensions, ...space.extendDs]).getState(allMeasures.map(m => m.key), allMeasures.map(m => m.op))
            };
        })
    }
}