import 'whatwg-fetch';
import _ from 'lodash';
import { API, wrapRequest } from './_config';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import { Row, Col, Jumbotron, Button, PageHeader, Modal, FormGroup, FormControl, ControlLabel, Checkbox, Alert } from 'react-bootstrap';
import AnimatedNumber from 'react-animated-number';
import Check from 'react-icons/lib/io/checkmark-round';
import numeral from 'numeral';
import React, { Component } from 'react';

export default class App extends Component {
	constructor(props) {
		super(props);

		this.state = {
			popup: null,
			discover: []
		};
	}

	componentWillMount() {
		this.refresh();
	}

	refresh() {
		fetch(API + 'info', wrapRequest())
			.then(resp => resp.json())
			.then(json => this.setState({ info: json }))
			.then(() => fetch(API + 'discover', wrapRequest()))
			.then(resp => resp.json())
			.then(json => this.setState({ discover: json }))
			.then(() => {
				setTimeout(this.refresh.bind(this), 1000)
			})
			.catch(err => console.log(err));
	}

	popupOpen(row, isSelected, e) {
		this.setState({
			popup: {
				updated: false,
				addr: row.addr,
				name: row.name,
				nameOrig: row.name,
				tracked: row.tracked,
				trackedOrig: row.tracked
			}
		})
	}

	popupHandleUpdate() {
		if (!this.state.popup.updated)
			return this.popupHandleClose();

		console.log('updating...');
		fetch(API + 'register', wrapRequest({
			method: 'POST',
			body: JSON.stringify({
				addr: this.state.popup.addr,
				name: this.state.popup.name,
				tracked: this.state.popup.tracked
			})
		}))
			.then(resp => resp.json())
			.then(json => {
				console.log(json);
				// TODO: display a success message
				return this.popupHandleClose();
			})
			.catch(err => {
				console.error(err);
				// TODO: display a failure message
				return this.popupHandleClose();
			});
	}

	popupHandleClose() {
		this.setState({ popup: null });
	}

	popupHandleNameChanged(e) {
		let newPopup = _.extend({}, this.state.popup);
		newPopup.name = e.target.value;
		newPopup.updated = newPopup.tracked !== newPopup.trackedOrig || newPopup.name !== newPopup.nameOrig;
		this.setState({ popup: newPopup });
	}

	popupHandleTrackingChanged(tracked) {
		let newPopup = _.extend({}, this.state.popup);
		newPopup.tracked = tracked;
		newPopup.updated = newPopup.tracked !== newPopup.trackedOrig || newPopup.name !== newPopup.nameOrig;
		this.setState({ popup: newPopup });
	}

	nameFormatter(cell, row) {
		return (
			<span>
				<div>{row.name ? (<strong>{row.name}</strong>) : (<span className="text-muted">&nbsp;</span>)}</div>
				<div className="visible-xs text-muted addr">{row.addr}</div>
			</span>
		);
	}

	trackedFormatter(cell, row) {
		return (
			<span>{row.tracked ? <Check /> : null}</span>
		);
	}

	countFormatter(cell, row) {
		return (
			<span>{numeral(row.count).format('0,0')}</span>
		);
	}

	render() {
		const selectRow = {
			mode: 'radio',
			hideSelectColumn: true,
			bgColor: '#fdece8',
			clickToSelect: true,
			onSelect: this.popupOpen.bind(this)
		};
		return (
			<span>
				{(() => {
					if (this.state.popup) {
						return (
							<Modal show={true} onHide={this.popupHandleClose.bind(this)}>
								<Modal.Header closeButton>
									<Modal.Title>{this.state.popup.nameOrig ? "Update " + this.state.popup.nameOrig : "Update Device"}</Modal.Title>
								</Modal.Header>
								<Modal.Body>
									<Alert bsStyle={this.state.popup.tracked ? "info" : "warning"}>
										<strong className="text-md">Tracking {this.state.popup.tracked ? "On" : "Off"}</strong>
										{this.state.popup.tracked
											? <p><code>zing-relay</code> will sync bluetooth packets with the ZING cloud</p>
											: <p>real-time tracking is disabled for this device</p>}
									</Alert>
									<form>
										<FormGroup controlId="formBasicText">
											<ControlLabel>Device Name</ControlLabel>
											<FormControl
												type="text"
												autoComplete="off"
												defaultValue={this.state.popup.name ? this.state.popup.name : null}
												placeholder="Enter text"
												onChange={this.popupHandleNameChanged.bind(this)}
											/>
											<FormControl.Feedback />
										</FormGroup>
										<p>Enabling tracking will allow the site to collect real-time location data for this device</p>
										<FormGroup controlId="formBasicText">
											<ButtonGroup>
												<Button bsStyle={this.state.popup.tracked ? "primary" : null} onClick={() => this.popupHandleTrackingChanged(true)}>Tracking</Button>
												<Button bsStyle={this.state.popup.tracked ? null : "primary"} onClick={() => this.popupHandleTrackingChanged(false)}>No Tracking</Button>
											</ButtonGroup>
										</FormGroup>
									</form>
								</Modal.Body>
								<Modal.Footer>
									<Button onClick={this.popupHandleClose.bind(this)}>Close</Button>
									<Button bsStyle={this.state.popup.updated ? 'primary' : null} onClick={this.popupHandleUpdate.bind(this)}>Update</Button>
								</Modal.Footer>
							</Modal>
						);
					}
				})()}
				<Row>
					<Col md={8} mdOffset={2} sm={10} smOffset={1} className="p-a-md">
						<PageHeader>
							<span className="text-muted">ZING</span> <strong>RELAY</strong>
							<span className="pull-right">
								<span className="text-muted addr text-xs">{this.state.info ? this.state.info.addr : null}</span>
							</span>
						</PageHeader>
						<h4 className="text-center">
							{this.state.info ? this.state.info.name : null}
						</h4>
						<Jumbotron className="p-a r-a">
							<h1 className="server-site text-center"><strong>{this.state.info && this.state.info.mqtt ? this.state.info.mqtt.access.site.name : "-"}</strong></h1>
							<h3 className="server-status text-center"><strong className={this.state.info && this.state.info.mqtt && this.state.info.mqtt.status == 'connected' ? "success" : "danger"}>{this.state.info && this.state.info.mqtt ? "Server " + this.state.info.mqtt.status : "Server Disconnected"}</strong></h3>
							<h4 className="server-status text-center text-muted"><strong><AnimatedNumber value={this.state.info && this.state.info.mqtt ? this.state.info.mqtt.count : 0}
								style={{
									transition: '0.8s ease-out',
									transitionProperty: 'background-color, color, opacity'
								}}
								stepPrecision={0}
								formatValue={n => { return numeral(n).format('0,0') }}
								duration={300} /> Messages</strong></h4>
						</Jumbotron>
						<BootstrapTable data={this.state.discover} striped={true} hover={true} selectRow={selectRow} bordered={false} options={{ defaultSortName: 'rssi', defaultSortOrder: 'desc' }}>
							<TableHeaderColumn dataField="addr" isKey={true} dataSort={true} className="hidden-xs" columnClassName="addr hidden-xs">Address</TableHeaderColumn>
							<TableHeaderColumn dataField="tracked" dataSort={true} dataFormat={this.trackedFormatter} dataAlign="center" width="25%">Tracked</TableHeaderColumn>
							<TableHeaderColumn dataField="name" dataFormat={this.nameFormatter} dataSort={true}>Name</TableHeaderColumn>
							<TableHeaderColumn dataField="rssi" dataSort={true} dataAlign="right" width="17%">RSSI</TableHeaderColumn>
							<TableHeaderColumn dataField="count" dataFormat={this.countFormatter} dataSort={true} dataAlign="right" className="hidden-xs" columnClassName="hidden-xs" width="17%">Count</TableHeaderColumn>
						</BootstrapTable>
					</Col>
				</Row>
			</span>
		);
	}
}
