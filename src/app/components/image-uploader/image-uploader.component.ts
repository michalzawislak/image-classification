import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import {Prediction} from "../../model/prediction";
import {KNNClassifier} from "@tensorflow-models/knn-classifier";
import {MobileNet} from "@tensorflow-models/mobilenet";
import {PredictionClass} from "../../model/predictionClass";
import * as cocoSSD from '@tensorflow-models/coco-ssd';
import {ObjectDetection} from "@tensorflow-models/coco-ssd";

@Component({
  selector: 'app-image-uploader',
  templateUrl: './image-uploader.component.html',
  styleUrls: ['./image-uploader.component.scss']
})
export class ImageUploaderComponent implements OnInit {
  imageSrc: string;
  classifiedImgScr: string;
  @ViewChild('img', {static: false}) imageEl: ElementRef;
  @ViewChild('classifiedImg', {static: false}) classifiedImage: ElementRef;
  @ViewChild('label', {static: false}) labelInput: ElementRef;
  @ViewChild('webcamElement', {static: false}) webcamElement: ElementRef;

  public knnClassifier: KNNClassifier;
  public mobileNetModel: MobileNet;
  public cocoSsd: ObjectDetection;
  public predictions: Prediction[];
  public loading: boolean = false;

  constructor() { }

  public async ngOnInit() {
    this.mobileNetModel = await mobilenet.load();
    this.knnClassifier = await knnClassifier.create();
    this.cocoSsd = await cocoSSD.load({ base: "mobilenet_v2" });
  }

  public async getClassifierImages(event) {
    const labelInput = this.labelInput.nativeElement;
    const label = labelInput.value;
    this.loading = true;
    if (event.target.files && event.target.files[0]) {
      const files = [...event.target.files];
      files.forEach( (file, i) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (res: any) => {
          this.imageSrc = res.target.result;
          setTimeout(async () => {
            const imgEl = this.imageEl.nativeElement;
            this.predictions = await this.mobileNetModel.classify(imgEl);
            await this.addDatasetClass(imgEl,label);
            if(i === files.length - 1) this.loading = false;
          }, 0);
        };
      })
    }
  }

  public async saveClassifier(classifierModel) {
    let dataset = classifierModel.getClassifierDataset()
    let datasetObject = {}
    Object.keys(dataset).forEach((key) => {
      let data = dataset[key].dataSync();
      datasetObject[key] = Array.from(data);
    });
    let jsonModel = JSON.stringify(datasetObject)

    let downloader = document.createElement('a');
    downloader.download = "model.json";
    downloader.href = 'data:text/text;charset=utf-8,' + encodeURIComponent(jsonModel);
    document.body.appendChild(downloader);
    downloader.click();
    downloader.remove();
  };

  public async uploadModel(classifierModel, event) {
    let inputModel = event.target.files;
    let reader = new FileReader();
    if (inputModel.length > 0) {
      reader.onload = async () => {
        let dataset = reader.result as string;
        let tensorObj = JSON.parse(dataset);

        Object.keys(tensorObj).forEach((key) => {
          tensorObj[key] = tf.tensor(tensorObj[key], [tensorObj[key].length / 1024, 1024]);
        });
        classifierModel.setClassifierDataset(tensorObj);
      };
    }
    await reader.readAsText(inputModel[0]);
  };

  public async addDatasetClass(img, label) {
    // @ts-ignore
    const activation = this.mobileNetModel.infer(img,'conv_preds');
    this.knnClassifier.addExample(activation, label);
  };

  public async imageClassification(event) {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.readAsDataURL(event.target.files[0]);
      reader.onload = (res: any) => {
        this.classifiedImgScr = res.target.result;

        setTimeout(async () => {
          const imgEl = this.classifiedImage.nativeElement;
          if(this.knnClassifier.getNumClasses() > 0) {
            const activation = this.mobileNetModel.infer(imgEl, true);
            const result: PredictionClass = await this.knnClassifier.predictClass(activation);
            console.log(`
            prediction: ${result.label}\n
            probability: ${result.confidences[result.label] * 100}%
          `);
          }
          await tf.nextFrame();
        }, 0);
      };
    }
  }

  public async detectOnImage(event) {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.readAsDataURL(event.target.files[0]);
      reader.onload = (res: any) => {
        this.classifiedImgScr = res.target.result;

        setTimeout(async () => {
          const imgEl = this.classifiedImage.nativeElement;
          let result = await this.cocoSsd.detect(imgEl);
          console.log(result);
        }, 0);
      };
    }
  }
}
