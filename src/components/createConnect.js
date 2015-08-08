import createStoreShape from '../utils/createStoreShape';
import shallowEqualScalar from '../utils/shallowEqualScalar';
import shallowEqual from '../utils/shallowEqual';
import isPlainObject from '../utils/isPlainObject';
import wrapActionCreators from '../utils/wrapActionCreators';
import invariant from 'invariant';

const defaultMapStateToProps = () => ({});
const defaultMapDispatchToProps = dispatch => ({ dispatch });
const defaultMergeProps = (stateProps, dispatchProps, parentProps) => ({
  ...parentProps,
  ...stateProps,
  ...dispatchProps
});

function getDisplayName(Component) {
  return Component.displayName || Component.name || 'Component';
}

function areStatePropsEqual(stateProps, nextStateProps) {
  const isRefEqual = stateProps === nextStateProps;
  if (
    isRefEqual ||
    typeof stateProps !== 'object' ||
    typeof nextStateProps !== 'object'
  ) {
    return isRefEqual;
  }

  return shallowEqual(stateProps, nextStateProps);
}

export default function createConnect(React) {
  const { Component, PropTypes } = React;
  const storeShape = createStoreShape(PropTypes);

  return function connect(
    mapStateToProps = defaultMapStateToProps,
    actionCreatorsOrMapDispatchToProps = defaultMapDispatchToProps,
    mergeProps = defaultMergeProps
  ) {
    const shouldSubscribe = mapStateToProps !== defaultMapStateToProps;
    const mapDispatchToProps = isPlainObject(actionCreatorsOrMapDispatchToProps) ?
      wrapActionCreators(actionCreatorsOrMapDispatchToProps) :
      actionCreatorsOrMapDispatchToProps;

    return DecoratedComponent => class Connect extends Component {
      static displayName = `Connect(${getDisplayName(DecoratedComponent)})`;
      static DecoratedComponent = DecoratedComponent;

      static contextTypes = {
        store: storeShape.isRequired
      };

      shouldComponentUpdate(nextProps, nextState) {
        return (
          this.isSubscribed() &&
          !areStatePropsEqual(this.state.stateProps, nextState.stateProps)
        ) || !shallowEqualScalar(this.props, nextProps);
      }

      constructor(props, context) {
        super(props, context);
        this.setUnderlyingRef = ::this.setUnderlyingRef;
        this.state = {
          ...this.mapState(props, context),
          ...this.mapDispatch(context)
        };
      }

      isSubscribed() {
        return typeof this.unsubscribe === 'function';
      }

      componentWillMount() {
        if (shouldSubscribe) {
          this.unsubscribe = this.context.store.subscribe(::this.handleChange);
        }
      }

      componentWillUnmount() {
        if (this.isSubscribed()) {
          this.unsubscribe();
        }
      }

      handleChange(props = this.props) {
        const nextState = this.mapState(props, this.context);
        if (!areStatePropsEqual(this.state.stateProps, nextState.stateProps)) {
          this.setState(nextState);
        }
      }

      mapState(props = this.props, context = this.context) {
        const state = context.store.getState();
        const stateProps = mapStateToProps(state);

        invariant(
          isPlainObject(stateProps),
          '`mapStateToProps` must return an object. Instead received %s.',
          stateProps
        );

        return { stateProps };
      }

      mapDispatch(context = this.context) {
        const { dispatch } = context.store;
        const dispatchProps = mapDispatchToProps(dispatch);

        invariant(
          isPlainObject(dispatchProps),
          '`mapDispatchToProps` must return an object. Instead received %s.',
          dispatchProps
        );

        return { dispatchProps };
      }

      merge(props = this.props, state = this.state) {
        const { stateProps, dispatchProps } = state;
        const merged = mergeProps(stateProps, dispatchProps, props);

        invariant(
          isPlainObject(merged),
          '`mergeProps` must return an object. Instead received %s.',
          merged
        );

        return merged;
      }

      getUnderlyingRef() {
        return this.underlyingRef;
      }

      setUnderlyingRef(instance) {
        this.underlyingRef = instance;
      }

      render() {
        return (
          <DecoratedComponent ref={this.setUnderlyingRef}
                              {...this.merge()} />
        );
      }
    };
  };
}
