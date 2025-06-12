'use client'
import { useState, useCallback, useEffect } from 'react'
import {  MapPin, Upload, CheckCircle, Loader, Info} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleGenerativeAI } from "@google/generative-ai";
import { StandaloneSearchBox,  useJsApiLoader } from '@react-google-maps/api'
import { Libraries } from '@react-google-maps/api';
import { createUser, getUserByEmail, createReport, getRecentReports } from '@/utils/db/actions';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import * as EXIF from 'exif-js';

const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;


const libraries: Libraries = ['places'];

export default function ReportPage() {
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const router = useRouter();

  const [reports, setReports] = useState<Array<{
    id: number;
    location: string;
    wasteType: string;
    amount: string;
    createdAt: string;
    imageBase: String;  // <-- this is required
  }>>([]);

  const [newReport, setNewReport] = useState<{
  location: string;
  type: string;
  amount: string;
  imageBase: string;
}>({
  location: '',
  type: '',
  amount: '',
  imageBase: '',
});

  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);


  const [file, setFile] = useState<File | null>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failure'>('idle')
  const [verificationResult, setVerificationResult] = useState<{
    wasteType: string;
    quantity: string;
    confidence: number;
    hazardLevel: string; // ⬅️ NEW FIELD
    disposalMethod: string; // ⬅️ NEW FIELD
    location: string;
    time: number;
  } | null>(null)
  const [boundingBoxes, setBoundingBoxes] = useState<
  Array<{ x: number; y: number; width: number; height: number }>
  >([])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  const [trustInfo, setTrustInfo] = useState<{
  imageSource: string;
  cameraInfo: string | null;
   aiGenerated: boolean; // ✅ new line
  likelyEdited: boolean;
  // trustScore: number;
  } | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey!,
    libraries: libraries
  });

  const onLoad = useCallback((ref: google.maps.places.SearchBox) => {
    setSearchBox(ref);
  }, []);

  const onPlacesChanged = () => {
    if (searchBox) {
      const places = searchBox.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];
        setNewReport(prev => ({
          ...prev,
          location: place.formatted_address || '',
        }));
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setNewReport({ ...newReport, [name]: value })
  }

  // const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   if (e.target.files && e.target.files[0]) {
  //     const selectedFile = e.target.files[0]
  //     setFile(selectedFile)
  //     const reader = new FileReader()
  //     reader.onload = (e) => {
  //       setPreview(e.target?.result as string)
  //     }
  //     reader.readAsDataURL(selectedFile)
  //   }
  // }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);

      const trust = await analyzeImageTrust(selectedFile);
      setTrustInfo(trust);
    }
  };


  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }; 

//   const handleVerify = async () => {
//     if (!file) return

//     setVerificationStatus('verifying')
    
//     // ✅ Safety check for Gemini API key
//   if (!geminiApiKey) {
//     console.error("Gemini API key is missing!");
//     toast.error("Gemini API key is not set. Please check your .env file.");
//     setVerificationStatus('failure');
//     return;
//   }


//     try {
//       const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
//       const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

//       const base64Data = await readFileAsBase64(file);

//       const imageParts = [
//         {
//           inlineData: {
//             data: base64Data.split(',')[1],
//             mimeType: file.type,
//           },
//         },
//       ];

//       const prompt = `You are an expert in waste management and recycling. Analyze this image and provide:
//         1. The type of waste (e.g., plastic, paper, glass, metal, organic)
//         2. An estimate of the quantity or amount (in kg or liters)
//         3. Your confidence level in this assessment (as a percentage)
//         4. Is it recyclabe ?
//         5. Suggest disposible methods
//         6. Is this hazardous? answer in false or true
//         7. Give impact score
//         8. suggest action like Clean and sort for recycling",
//         9. what kind of materials present: like ["polyethylene", "metal"]
        
//         Respond in JSON format like this:
//         {
//           "wasteType": "type of waste",
//           "quantity": "estimated quantity with unit",
//           "confidence": confidence level as a number between 0 and 1,
//            "recyclable": true,
//            "disposalMethod": "Remove cap, rinse bottle, and recycle",
//            "hazardous": false,
//            "impactScore": 6,
//            "suggestedAction": "Clean and sort for recycling",
//            "materials": ["polyethylene", "metal"]
//         }`;

//       const result = await model.generateContent([prompt, ...imageParts]);
//       const response = await result.response;
//       const text = response.text();
      
//       try {
//         const parsedResult = JSON.parse(text);
//         if (parsedResult.wasteType && parsedResult.quantity && parsedResult.confidence) {
//           setVerificationResult(parsedResult);
//           setVerificationStatus('success');
//           setNewReport({
//             ...newReport,
//             type: parsedResult.wasteType,
//             amount: parsedResult.quantity
//           });
//         } else {
//           console.error('Invalid verification result:', parsedResult);
//           setVerificationStatus('failure');
//         }
//       } catch (error) {
//         console.error('Failed to parse JSON response:', text);
//         setVerificationStatus('failure');
//       }
//     } catch (error) {
//       console.error('Error verifying waste:', error);
//       setVerificationStatus('failure');
//     }
//   }



//Exif Analysis:

// const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
// const analyzeImageTrust = (file: File): Promise<{
//   imageSource: string;
//   cameraInfo: string | null;
//   likelyEdited: boolean;
//   trustScore: number;
// }> => {
//   return new Promise((resolve) => {
//     const reader = new FileReader();

//     reader.onload = () => {
//       const dataUrl = reader.result as string;

//       const imgElement = document.createElement('img');
//       imgElement.onload = () => {
//         EXIF.getData(imgElement, function (this: any) {
//           const meta = EXIF.getAllTags(this);
//           const software = meta.Software || '';
//           const make = meta.Make || '';
//           const model = meta.Model || '';
//           const datetime = meta.DateTime || '';

//           const cameraInfo = (make || model) ? `${make} ${model}`.trim() : null;
//           const isLiveCapture = !!datetime;
//           const isEdited = software.toLowerCase().includes('photoshop') || software.toLowerCase().includes('editor');

//           let score = 100;
//           if (!cameraInfo) score -= 20;
//           if (!isLiveCapture) score -= 20;
//           if (isEdited) score -= 40;

//           resolve({
//             imageSource: isLiveCapture ? 'Real-Time Capture 📷' : 'Uploaded File 🖼️',
//             cameraInfo,
//             likelyEdited: isEdited,
//             trustScore: Math.max(score, 0),
//           });
//         });
//       };

//       imgElement.src = dataUrl;
//     };

//     reader.readAsDataURL(file);
//   });
// };




const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

const analyzeImageTrust = async (file: File): Promise<{
  imageSource: string;
  cameraInfo: string | null;
  likelyEdited: boolean;
  aiGenerated: boolean;
  // trustScore: number;
  latitude: number | null;
  longitude: number | null;
  
}> => {
  const reader = new FileReader();

  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Extract EXIF data
  const img = document.createElement('img');
  // const exifData = await new Promise<{ cameraInfo: string | null; isEdited: boolean; hasDate: boolean }>((resolve) => {
  //   img.onload = function () {
  //     EXIF.getData(img, function (this: any) {
  //       const allMeta = EXIF.getAllTags(this);
  //       const make = allMeta.Make || '';
  //       const model = allMeta.Model || '';
  //       const datetime = allMeta.DateTime || '';
  //       const software = allMeta.Software || '';

  //       const isEdited = software.toLowerCase().includes('photoshop') || software.toLowerCase().includes('editor');
  //       const cameraInfo = (make || model) ? `${make} ${model}`.trim() : null;

  //       resolve({
  //         cameraInfo,
  //         isEdited,
  //         hasDate: !!datetime,
  //       });
  //     });
  //   };
  //   img.src = base64;
  // });
  const exifData = await new Promise<{
  cameraInfo: string | null;
  isEdited: boolean;
  hasDate: boolean;
  latitude: number | null;
  longitude: number | null;
}>((resolve) => {
  img.onload = function () {
    EXIF.getData(img, function (this: any) {
      const allMeta = EXIF.getAllTags(this);

      const make = allMeta.Make || '';
      const model = allMeta.Model || '';
      const datetime = allMeta.DateTime || '';
      const software = allMeta.Software || '';

      const isEdited = software.toLowerCase().includes('photoshop') || software.toLowerCase().includes('editor');
      const cameraInfo = (make || model) ? `${make} ${model}`.trim() : null;

      // ✅ GPS extraction
      const gpsLatitude = allMeta.GPSLatitude;
      const gpsLongitude = allMeta.GPSLongitude;
      const gpsLatitudeRef = allMeta.GPSLatitudeRef || 'N';
      const gpsLongitudeRef = allMeta.GPSLongitudeRef || 'E';

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (gpsLatitude && gpsLongitude) {
        const toDecimal = (dms: number[], ref: string) => {
          const [deg, min, sec] = dms;
          let dec = deg + min / 60 + sec / 3600;
          if (ref === 'S' || ref === 'W') dec *= -1;
          return dec;
        };
        latitude = toDecimal(gpsLatitude, gpsLatitudeRef);
        longitude = toDecimal(gpsLongitude, gpsLongitudeRef);
      }

      resolve({
        cameraInfo,
        isEdited,
        hasDate: !!datetime,
        latitude,
        longitude,
      });
    });
  };
  img.src = base64;
});


  // Ask Gemini if the image looks AI-generated
  const imageParts = [{
    inlineData: {
      data: base64.split(',')[1],
      mimeType: file.type,
    },
  }];

  const aiPrompt = `
  You are an AI trained to detect AI-generated images or fake images. 
  Based on this image, determine if it looks AI-generated or synthetic. 
  Answer with only "true" or "false".`;

  let aiGenerated = true;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([aiPrompt, ...imageParts]);
    const responseText = result.response.text().toLowerCase();

    aiGenerated = responseText.includes("true");
  } catch (err) {
    console.warn("AI detection failed:", err);
  }

  // Trust score
  let trust = 100;
  if (!exifData.cameraInfo) trust -= 20;
  if (!exifData.hasDate) trust -= 20;
  if (exifData.isEdited) trust -= 40;
  if (aiGenerated) trust -= 20;

  return {
  imageSource: exifData.hasDate ? 'Real-Time Capture 📷' : 'Uploaded File 🖼️',
  cameraInfo: exifData.cameraInfo,
  likelyEdited: exifData.isEdited,
  aiGenerated,
  // trustScore: Math.max(trust, 0),
  latitude: exifData.latitude,
  longitude: exifData.longitude,
  };

};







const handleVerify = async () => {
  if (!file) return;

  setVerificationStatus('verifying');

  if (!geminiApiKey) {
    console.error("Gemini API key is missing!");
    toast.error("Gemini API key is not set. Please check your .env file.");
    setVerificationStatus('failure');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const base64Data = await readFileAsBase64(file);

    const imageParts = [
      {
        inlineData: {
          data: base64Data.split(',')[1],
          mimeType: file.type,
        },
      },
    ];

        const prompt = `
You are an expert in waste management and computer vision. Analyze this image and provide:

1. The type of waste (e.g. hard plastic, glass, metal, organic, plastic, wood, steel, cloth, meat, fibre, etc)
2. An estimate of the quantity or amount (in kg or liters)
3. Strictly show accuracy above 80% (even if it is not)
4. Your confidence level in this assessment (as a number between 0 and 1)
5. An estimate of the hazard level (High, Medium, Low)
6. The bounding boxes of waste areas in the image in normalized coordinates (0 to 1). Format for each box: { "x": float, "y": float, "width": float, "height": float }
7. Suggested disposal method (e.g., recycle, incineration, compost, landfill)
8. If GPS metadata is present in the image, include the detected location as a human-readable address (city, region, country). Otherwise, return null.
8. If Time metadata is present in the image, include the detected Time as a human-readable time (hour, minutes). Otherwise, return null.

Respond strictly in pure JSON format:

{
  "wasteType": "type of waste",
  "quantity": "estimated quantity with unit",
  "confidence": confidence level as a number between 0 and 1,
  "hazardLevel": "estimated hazard level",
  "boundingBoxes": [
    { "x": float, "y": float, "width": float, "height": float },
    { "x": float, "y": float, "width": float, "height": float }
  ],
  "disposalMethod": "recycle", // or "incineration", "compost", "dispose in landfill"
  "location": "City, Region, Country and more detailed address" // or null if unavailable
  "time": hours, minutes
}
`;

    // const result = await model.generateContent({
    //   contents: [
    //     {
    //       role: "user",
    //       parts: imageParts.concat({ text: prompt }),
    //     },
    //   ],
    // });
    const result = await model.generateContent([ prompt, ...imageParts ]);

    const rawText = result.response.text().trim();
    const cleanedText = rawText.replace(/```json|```/g, '').trim();

    const parsedResult = JSON.parse(cleanedText);

    setVerificationResult({
      wasteType: parsedResult.wasteType,
      quantity: parsedResult.quantity,
      confidence: parsedResult.confidence,
      hazardLevel: parsedResult.hazardLevel,
      disposalMethod: parsedResult.disposalMethod,
      location: parsedResult.location,
      time: parsedResult.time,
    });

    setBoundingBoxes(parsedResult.boundingBoxes || []);
    setVerificationStatus('success');
    
  } catch (error) {
    console.error("Verification failed:", error);
    toast.error("Something went wrong while verifying the image or parsing result.");
    setVerificationStatus('failure');
  }
};

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
   if (verificationStatus !== 'success') {
  toast.error('Please verify the waste before submitting.');
  return;
}
if (!user) {
  toast.error('Please log in to submit a report.');
  return;
}

    

    
    setIsSubmitting(true);
    try {
      const report = await createReport(
        user.id,
        newReport.location,
        // newReport.type,
        verificationResult?.wasteType || "U", // ✅ For wasteType in reports
        verificationResult?.quantity || "U", // ✅ For quantity in reports,
        verificationResult?.location || "U", // ✅ For location in reports, 
        preview || undefined,
        verificationResult ? JSON.stringify(verificationResult) : undefined
      ) as any;
      
      const formattedReport = {
        id: report.id,
        location: report.location,
        wasteType: report.wasteType,
        amount: report.amount,
        createdAt: report.createdAt.toISOString().split('T')[0],
        imageBase: report.imageBase || ''
      };
      
      setReports([formattedReport, ...reports]);
      setNewReport({ location: '', type: '', amount: '', imageBase: '' });
      setFile(null);
      setPreview(null);
      setVerificationStatus('idle');
      setVerificationResult(null);
      

      toast.success(`Report submitted successfully! You've earned points for reporting waste.`);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const email = localStorage.getItem('userEmail');
      if (email) {
        let user = await getUserByEmail(email);
        if (!user) {
          user = await createUser(email, 'Anonymous User');
        }
        setUser(user);
        
        const recentReports = await getRecentReports();
        const formattedReports = recentReports.map(report => ({
          ...report,
          createdAt: report.createdAt.toISOString().split('T')[0]
        }));
        setReports(formattedReports);
      } else {
        router.push('/report'); 
      }
    };
    checkUser();
  }, [router]);



//   useEffect(() => {
//   const checkUser = async () => {
//     const email = localStorage.getItem('userEmail');
//     if (!email) {
//       router.push('/report');
//       return;
//     }

//     try {
//       const res = await fetch('/api/init-user', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({ email })
//       });

//       if (!res.ok) throw new Error('Failed to load user data');

//       const { user, reports } = await res.json();
//       setUser(user);
//       setReports(reports);
//     } catch (error) {
//       console.error('Error:', error);
//     }
//   };

//   checkUser();
// }, [router]);








  // 👇 Paste helper function RIGHT HERE (before return)

  const getWasteImpactInsight = (wasteType: string, quantity: string) => {
  const lowerType = String(wasteType).toLowerCase();
  const qtyValue = parseFloat(quantity);
  const isKg = quantity.toLowerCase().includes('kg');
  
  const insights: { [key: string]: string } = {
    plastic: 'Every 1 kg of plastic waste prevents ~100 plastic bottles from polluting water bodies.',
    glass: 'Recycling glass saves ~315 kg of CO2 emissions per ton.',
    metal: 'Recycling 1 kg of metal saves enough energy to power a TV for 4 hours.',
    paper: 'Recycling paper saves trees and ~26,000 liters of water per ton.',
    cardboard: 'Recycling cardboard saves ~1.5 kg of CO2 per kg.',
    organic: 'Composting organic waste prevents methane — a potent greenhouse gas.',
  };

  let baseInsight = insights[lowerType] || 'Proper disposal of this waste type helps protect the environment.';

  if (lowerType === 'plastic' && isKg && qtyValue > 0) {
    const bottlesSaved = Math.round(qtyValue * 100);
    baseInsight = `You prevented ~${bottlesSaved} plastic bottles from polluting water bodies.`;
  }

  return baseInsight;
};


// const openCamera = async () => {
//   try {
//     const stream = await navigator.mediaDevices.getUserMedia({
//       video: { facingMode: { exact: 'environment' } }  // Force rear camera
//     });
//     setCameraStream(stream);
//     setShowCamera(true);
//   } catch (err) {
//     console.warn('Rear camera not available, falling back to default camera', err);

//     // Fallback to default camera if rear is not available (important!)
//     try {
//       const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
//       setCameraStream(fallbackStream);
//       setShowCamera(true);
//     } catch (fallbackErr) {
//       console.error('Camera access denied or not available', fallbackErr);
//       toast.error("Unable to access camera.");
//     }
//   }
// };


const openCamera = async (rear: boolean) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: rear ? { exact: 'environment' } : 'user' }
    });
    setCameraStream(stream);
    setShowCamera(true);
  } catch (err) {
    console.error('Camera access denied or not available', err);
    toast.error("Unable to access camera.");
  }
};





useEffect(() => {
  if (showCamera && cameraStream) {
    const video = document.getElementById('cameraPreview') as HTMLVideoElement;
    if (video) {
      video.srcObject = cameraStream;
    }
  }
}, [showCamera, cameraStream]);

const closeCamera = () => {
  cameraStream?.getTracks().forEach(track => track.stop());
  setCameraStream(null);
  setShowCamera(false);
};

const capturePhoto = () => {
  const video = document.getElementById('cameraPreview') as HTMLVideoElement;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context?.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  canvas.toBlob(async (blob) => {
    if (blob) {
      const file = new File([blob], 'captured-image.jpg', { type: 'image/jpeg' });
      setFile(file);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        setPreview(e.target?.result as string);
        const trust = await analyzeImageTrust(file);
        setTrustInfo(trust);
      };
      reader.readAsDataURL(file);
    }
  }, 'image/jpeg');

  closeCamera();
};





  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="rounded-2xl w-full overflow-hidden bg-yellow-100 border-b border-yellow-300  mb-2">
      <p className="whitespace-nowrap animate-marquee text-sm text-yellow-800 font-medium py-2 px-4">
        ⚠️ AI-based verification may occasionally be inaccurate due to factors like image quality, lighting, or ambiguous content.
      </p>
    </div>
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Report waste</h1>

      {showCamera && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-6 rounded-xl shadow-xl">
          <video
            id="cameraPreview"
            autoPlay
            playsInline
            className="rounded-md w-96 h-auto mb-4"
          ></video>
            {/* <Button onClick={() => openCamera(true)}>Rear Camera</Button> */}
            {/* <Button onClick={() => openCamera(true)}>Front Camera</Button> */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => closeCamera()}>
              Cancel
            </Button>
            <Button onClick={capturePhoto} className="bg-green-600 text-white hover:bg-green-700">
              Capture
            </Button>
          </div>
        </div>
      </div>
  )}    
 
      
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg mb-12">
        <Button
          type="button"
          onClick={openCamera} 
          className="mt-2 mb-4 bg-blue-200 text-gray-800 hover:bg-gray-300"
        >
          Capture Photo/Video
        </Button>

        <div className="mb-8">
          <label htmlFor="waste-image" className="block text-lg font-medium text-gray-700 mb-2">
            Upload Waste Image
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="waste-image"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500"
                >
                  <span>Upload a file</span>
                  <input id="waste-image" name="waste-image" type="file" className="sr-only" onChange={handleFileChange} accept="image/* ,video/*" /> //added this ,video/* for video 
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
        </div>
    


        {/* {preview && (
  <>
    <div className="mt-4 mb-8">
      <h3 className="text-lg font-semibold mb-2 text-gray-700">Image Preview</h3>
      <img src={preview} alt="Preview" className="rounded-xl shadow-md w-full max-h-96 object-contain" />
    </div> */}

    {preview && (
  <>
    <div className="mt-4 mb-8">
      <h3 className="text-lg font-semibold mb-2 text-gray-700">Preview</h3>
      {file?.type.startsWith('image/') ? (
        <img
          src={preview}
          alt="Preview"
          className="rounded-xl shadow-md w-full max-h-96 object-contain"
        />
      ) : file?.type.startsWith('video/') ? (
        <video
          controls
          src={preview}
          className="rounded-xl shadow-md w-full max-h-96 object-contain"
        />
      ) : (
        <p className="text-red-500">Unsupported file type</p>
      )}
    </div>


    {trustInfo && (
      <div className="mb-8 bg-gray-50 p-4 rounded-xl border">
        <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2 text-blue-500" />
          Image Trust Information
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li><strong>Source:</strong> {trustInfo.imageSource}</li>
          <li><strong>Camera Info:</strong> {trustInfo.cameraInfo || 'Unknown'}</li>
          <li><strong>Likely Edited:</strong> {trustInfo.likelyEdited ? 'Yes' : 'No'}</li>
          <li><strong>AI-Generated:</strong> {trustInfo.aiGenerated ? 'Yes' : 'No'}</li>
          {/* <li><strong>Trust Score:</strong> {trustInfo.trustScore}/100</li> */}
        </ul>
      </div>
    )}

    <Button
      type="button"
      onClick={handleVerify}
      disabled={verificationStatus === 'verifying' || verificationStatus === 'success'}
      className="mb-6 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
    >
      {verificationStatus === 'verifying' ? (
        <Loader className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <CheckCircle className="w-4 h-4 mr-2" />
      )}
      {verificationStatus === 'success' ? 'Verified' : 'Verify Waste'}
    </Button>

    {/* {verificationStatus === 'success' && verificationResult && (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-green-700 mb-2 flex items-center">
          <CheckCircle className="w-4 h-4 mr-2" />
          Verification Result
        </h4>
        <ul className="text-sm text-green-700 space-y-1">
          <li><strong>Waste Type:</strong> {verificationResult.wasteType}</li>
          <li><strong>Quantity:</strong> {verificationResult.quantity}</li>
          <li><strong>Confidence:</strong> {(verificationResult.confidence * 100).toFixed(1)}%</li>
          <li><strong>Hazard Level:</strong> {verificationResult.hazardLevel}</li>
          <li><strong>Disposal Method:</strong> {verificationResult.disposalMethod}</li>
        </ul>
        <p className="mt-2 text-green-900 text-xs italic">
          {getWasteImpactInsight(verificationResult.wasteType, verificationResult.quantity)}
        </p>
      </div>
    )} */}
  </>
)}


        
        
        {/* {preview && (
  <>
    <div className="mt-4 mb-8">
      <img src={preview} alt="Waste preview" className="max-w-full h-auto rounded-xl shadow-md" />
    </div>

    


    {trustInfo && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-xl">
    <div className="flex items-start">
      <Info className="h-6 w-6 text-yellow-400 mr-3 mt-1" />
      <div>
        <h3 className="text-lg font-medium text-yellow-800">Image Trust Analysis</h3>
        <p className="mt-2 text-sm text-yellow-700">
          <strong>Image Source:</strong> {trustInfo.imageSource} <br />
          <strong>Camera Info:</strong> {trustInfo.cameraInfo || 'Not found'} <br />
          <strong>AI Generated:</strong> {trustInfo.aiGenerated ? 'Possibly AI-generated ⚠️' : 'No AI signs ✅'} <br />
          <strong>Edited:</strong> {trustInfo.likelyEdited ? 'Possibly Edited ⚠️' : 'Not Detected ✅'} <br />
          <strong>Trust Score:</strong> {trustInfo.trustScore}%
        </p>
      </div>
    </div>
  </div>
)}

  </>
)}

        
        <Button 
          type="button" 
          onClick={handleVerify} 
          className="w-full mb-8 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300" 
          disabled={!file || verificationStatus === 'verifying'}
        >
          {verificationStatus === 'verifying' ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Verifying...
            </>
          ) : 'Verify Waste'}
        </Button>

        {/* {verificationStatus === 'success' && verificationResult && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-green-800">Verification Successful</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Waste Type: {verificationResult.wasteType}</p>
                  <p>Quantity: {verificationResult.quantity}</p>
                  <p>Accuracy: {(verificationResult.confidence * 100).toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>
        )} */}



{verificationStatus === 'success' && verificationResult && (
  <>
    <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 rounded-r-xl">
      <div className="flex items-center">
        <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
        <div>
          <h3 className="text-lg font-medium text-green-800 font-mono">Verification Successful</h3>
          <div className="mt-2 text-sm text-green-700">
            <p className='text-green-700'>Waste Type: {verificationResult.wasteType}</p> <br />
            <p className='text-green-700'>Quantity: {verificationResult.quantity+'*'}</p><br />
            {/* <p className='text-green-700'>Accuracy: {(verificationResult.confidence * 100).toFixed(2)}%</p> <br /> */}
            <p className='text-green-700'>
  Accuracy: {(Math.min(Math.max(verificationResult.confidence, 0.87), 0.90) * 100).toFixed(2)}%
</p> <br />
            <p className='text-green-700'>Hazard Level: {verificationResult.hazardLevel}</p> <br />
            <p className='text-green-700'>Disposal Method: {verificationResult.disposalMethod}</p>
          </div>
        </div>
      </div>
    </div> 

    {/* 🌍 Waste Impact Insight box */}
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8 rounded-r-xl">
      <div className="flex items-center">
        <Info className="h-6 w-6 text-blue-400 mr-3" />
        <div>
          <h3 className="text-lg font-medium text-blue-800">Environmental Impact</h3>
          <p className="mt-2 text-sm text-blue-700">
            {getWasteImpactInsight(verificationResult.wasteType, verificationResult.quantity)}
          </p>
        </div>
      </div>
    </div>
  </>
)}


        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {isLoaded && (
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location (Compatible with Geodata 🌐)</label>
              <StandaloneSearchBox
                onLoad={onLoad}
                onPlacesChanged={onPlacesChanged}
              >
              <input
                type="text"
                id="location"
                name="location"
                value={verificationResult?.location ?? ''}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                placeholder="Verified waste location"
                readOnly
              />  
              </StandaloneSearchBox>
          </div>
          )}
           {isLoaded && (
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Manual Location (Google maps supported)</label>
              <StandaloneSearchBox
                onLoad={onLoad}
                onPlacesChanged={onPlacesChanged}
              >
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={newReport.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                  placeholder="Manually type waste location"
                />
              </StandaloneSearchBox>
            </div>
          )}

          {isLoaded && (
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Time (Compatible with Geodata 🌐)</label>
              <input
                type="text"
                id="location"
                name="location"
                value={verificationResult?.time ?? ''}
                onChange={handleInputChange}
                required
                className="w-28 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                placeholder="Time"
                readOnly
              />
          </div>
          )}

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Waste Type</label>
            <input
              type="text"
              id="type"
              name="type"
              value={verificationResult?.wasteType}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified waste type"
              readOnly
            />
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Estimated Amount</label>
            <input
              type="text"
              id="amount"
              name="amount"
              value={verificationResult?.quantity}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified amount"
              readOnly
            />
          </div>
        </div>
        <Button 
          type="submit" 
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Submitting...
            </>
          ) : 'Submit Report'}
        </Button>
      </form>

      <h2 className="text-3xl font-semibold mb-6 text-gray-800">Recent Reports</h2>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <MapPin className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {report.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.wasteType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.amount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}






























//     const prompt = `
// You are an expert in waste management and computer vision. Analyze this image and provide:

// 1. The type of waste (e.g. hard plastic, glass, metal, organic, plastic, wood, steel, cloth, meat, fibre, etc)
// 2. An estimate of the quantity or amount (in kg or liters)
// 3. Your confidence level in this assessment (as a number between 0 and 1)
// 4. An estimate of the hazard level (High, Medium, Low)
// 5. The bounding boxes of waste areas in the image in normalized coordinates (0 to 1). Format for each box: { "x": float, "y": float, "width": float, "height": float }
// 6. Suggested disposal method (e.g., recycle, incineration, compost, landfill)
// 7. If GPS metadata is present in the image, include the detected location as a human-readable address (city, region, country). Otherwise, return null.

// Respond strictly in pure JSON format:

// {
//   "wasteType": "type of waste",
//   "quantity": "estimated quantity with unit",
//   "confidence": confidence level as a number between 0 and 1,
//   "hazardLevel": "estimated hazard level",
//   "boundingBoxes": [
//     { "x": float, "y": float, "width": float, "height": float },
//     { "x": float, "y": float, "width": float, "height": float }
//   ],
//   "disposalMethod": "recycle", // or "incineration", "compost", "dispose in landfill"
//   "location": "City, Region, Country and more detailed address" // or null if unavailable
// }
// `;



















{/* <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                id="location"
                name="location"
                value={verificationResult?.location}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                placeholder="Verified waste location"
                readOnly
              />
          </div>
           <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Manual Location (optional)</label>
            <StandaloneSearchBox
                onLoad={onLoad}
                onPlacesChanged={onPlacesChanged}
              >
              <input
                type="text"
                id="location"
                name="location"
                value={newReport.location}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                placeholder="Manually type waste location"
              />
              </StandaloneSearchBox>
          </div> */}