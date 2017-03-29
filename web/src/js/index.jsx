import { Router } from 'react-router';
import createBrowserHistory from 'history/createBrowserHistory';
import App from './App';
import ReactDOM from 'react-dom';

const history = createBrowserHistory();

ReactDOM.render((
	<Router history={history}>
		<Route path="/" component={App} />
	</Router>
), document.getElementById('app'));
