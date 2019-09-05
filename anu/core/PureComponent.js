import { miniCreateClass } from "./util";
import { Component } from "./Component";
import { shallowEqual } from "./shallowEqual";


// purecomponent 就是帮你加上了 sCU 的组件嘛
export let PureComponent = miniCreateClass(
    function PureComponent() {
        this.isPureComponent = true;
    },
    Component,
    {
        shouldComponentUpdate(nextProps, nextState) {
            let a = shallowEqual(this.props, nextProps);
            let b = shallowEqual(this.state, nextState);

            return !a || !b;
        }
    }
)