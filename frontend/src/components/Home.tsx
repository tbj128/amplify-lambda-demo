import { ReactElement, useRef } from "react";
import { useHistory } from "react-router-dom";
import Amplify from "aws-amplify";
import Navbar from 'react-bootstrap/Navbar';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Spinner from 'react-bootstrap/Spinner';
import config from "../aws-exports";
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Dropzone from 'react-dropzone-uploader';
import axios from "axios";
import 'react-dropzone-uploader/dist/styles.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeartbeat } from '@fortawesome/free-solid-svg-icons'

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useState } from "react";

Amplify.configure(config);


const Home = (): ReactElement => {
    const history = useHistory();

    const [state, setState] = useState({
        isUploaded: false,
        isRendering: false,
        ecgName: "",
        waveform: [],
        ecgClassification: "",
        acsPrediction: "",
        dayOfWeek: "Wed"
    });
    const stateRef: any = useRef({});
    stateRef.current = state;

    // calls a Lambda function to parse the uploaded waveform file and returns it in a parseable array
    const getWaveform = async (name: string) => {
        const response = await axios.get(`https://k2k057rm22.execute-api.us-west-2.amazonaws.com/prod/parser?name=${name}`);
        // The server is expected to return an array that is of shape (1, 7500)
        // This represents a one lead, 15 sec ECG sampled at 500Hz. 
        // We will reduce this by a factor of 5 in order to have better plotting.
        //
        const waveform = response["data"][0].map((w: number, index: number) => {
            if (index % 5 === 0) {
                return {
                  II: w,
                };
            } else {
                return null;
            }
        }).filter((a: any) => a !== null)
        setState({...stateRef.current, waveform: waveform, isRendering: false})
    }

    // specify upload params and url for your files
    const getUploadParams = async ({ meta }: any) => {
        const response = await axios.get(`https://k2k057rm22.execute-api.us-west-2.amazonaws.com/prod/presigner?name=${meta["name"]}`);
        const fields = response["data"]["fields"];
        const uploadUrl = response["data"]["url"];
        const fileUrl = response["data"]["url"] + response["data"]["fields"]["key"];
        return { fields, meta: { fileUrl }, url: uploadUrl }
    }
    
    // called every time a file's `status` changes
    // possible states include: preparing, getting_upload_params, uploading, headers_received, removed
    const handleChangeStatus = ({ meta, remove }: any, status: any) => {
        if (status === 'headers_received') {
            console.log(`${meta.name} uploaded!`)
            remove()
            setState({...state, isUploaded: true, ecgName: meta.name, isRendering: true})
            getWaveform(meta.name)
        } else if (status === 'aborted') {
            console.log(`${meta.name}, upload failed...`)
        }
    }

    // receives array of files that are done uploading when submit button is clicked
    const handleSubmit = (files: any, allFiles: any) => {
      console.log(files.map((f: any) => f.meta))
      allFiles.forEach((f: any) => f.remove())
    }
  
    return (
        <>
            <Navbar bg="dark" variant="dark">
                <Navbar.Brand href="#home">
                    <img src="logo.png" style={{width:40, marginTop: -7}} />{' '}
                    ED Monitoring
                </Navbar.Brand>
            </Navbar>

            <Container fluid="md" className="uploader-container">
                <Row>
                    <Col>
                        <h3><FontAwesomeIcon className="mr-1" icon={faHeartbeat} />{' '}ECG Viewer</h3>
                        <p>Upload a 15-sec Lead-II ECG file (.npy format) to start (<a href="https://ed-monitor-models.s3.amazonaws.com/1066-0.npy" target="_blank">example file</a>).</p>
                        <p>{state.dayOfWeek}</p>
                    </Col>
                </Row>
            </Container>

            {!state.isUploaded ?
                <Container className="p-3">    
                    <Dropzone
                        getUploadParams={getUploadParams}
                        onChangeStatus={handleChangeStatus}
                        maxFiles={1}
                        multiple={false}
                        canCancel={false}
                        onSubmit={handleSubmit}
                        accept=".npy"
                        inputContent="Upload ECG Waveform"
                        addClassNames={
                            { dropzone: "custom-dropzone" }
                        }
                    />
                </Container>
            :
                <Container className="p-3">   
                    <LineChart
                        width={900}
                        height={300}
                        data={state.waveform}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                        >
                        <XAxis dataKey="Time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="II" stroke="#8884d8" animationDuration={500} dot={false} />
                    </LineChart>
                </Container>
            }

            {state.isUploaded && state.isRendering &&
                <Container className="p-3">
                    <Card>
                        <Container className="p-3">
                            <Spinner animation="border" role="status" size="sm" />{' '}Loading...
                        </Container>
                    </Card>
                </Container>
            }
        </>
    );
}

export default Home;
