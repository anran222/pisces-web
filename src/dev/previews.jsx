import {ComponentPreview, Previews} from '@react-buddy/ide-toolbox'
import {PaletteTree} from './palette'
import CreateExperiment from "../pages/CreateExperiment.jsx";

const ComponentPreviews = () => {
    return (
        <Previews palette={<PaletteTree/>}>
            <ComponentPreview path="/CreateExperiment">
                <CreateExperiment/>
            </ComponentPreview>
        </Previews>
    )
}

export default ComponentPreviews