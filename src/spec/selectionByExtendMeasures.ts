import { IPredicate } from "../utils";
import { TopLevelSpec } from "vega-lite";

interface ISpace {
    dimensions: string[];
    measures: string[];
}
export function selectionByExtendMeasures (predicates: IPredicate[], currentSpace: ISpace, extendMeasures: string[]) {
    const { dimensions, measures } = currentSpace;
    // 难点在于子视图的auto encoding。这部分没法直接使用VIEngine，是因为VIEngine的实际声明周期在webworker里就结束了。
    // 但实际上VIEngine的声明周期是一个完整的分析工作流，这几乎是和这个应用的声明周期是同步的
    // 所以我们需要做的是把VIengine的方法放到webworker里面去跑，而不是把整个VIEngine放到webworker里面去跑
    // const 
    const spec: TopLevelSpec = {
        vconcat: [
            {
                transform: [
                    {
                        filter: ''
                    }
                ],
                mark: 'tick',
                encoding: {
                    x: {
                        field: ''
                    }
                }
            }
        ]
    };
}