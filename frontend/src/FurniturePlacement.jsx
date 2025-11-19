import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Select,
  Input,
  Button,
  Typography,
  Card,
  Row,
  Col,
  Spin,
  Empty,
  Tooltip,
} from "antd";

const { Title, Text } = Typography;
const { Option } = Select;

function FurniturePlacement({ isDarkMode }) {
  const didFetch = useRef(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  // --- Room data ---
  const [generatedDesigns, setGeneratedDesigns] = useState([]);
  const [userRooms, setUserRooms] = useState([]);
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [selectedUserRoomId, setSelectedUserRoomId] = useState(null);
  const [selectedRoomImage, setSelectedRoomImage] = useState(null);
  const [pendingRoomFile, setPendingRoomFile] = useState(null);

  // --- Furniture data ---
  const [library, setLibrary] = useState([]);
  const [selectedLibraryFurniture, setSelectedLibraryFurniture] = useState(null);
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [furniturePreview, setFurniturePreview] = useState(null);
  const [furnitureDescription, setFurnitureDescription] = useState("");

  // --- Result / loading ---
  const [loading, setLoading] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [result, setResult] = useState(null);

  const textColor = isDarkMode ? "#e4e4e4" : "#111827";
  const bgColor = isDarkMode ? "#1f1f1f" : "#ffffff";
  const borderColor = isDarkMode ? "#333" : "#d9d9d9";

  // --- Init ---
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    const init = async () => {
      await fetchGeneratedDesigns();
      await fetchUserRooms();
      await fetchLibrary();
    };
    init();
  }, []);

  // --- Fetch functions ---
  const fetchGeneratedDesigns = async () => {
    setLoadingDesigns(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/designs/all");
      setGeneratedDesigns(res.data.designs || []);
    } catch {
      toast.error("Failed to fetch generated designs");
    } finally {
      setLoadingDesigns(false);
    }
  };

    const fetchUserRooms = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/api/rooms/all", {
          params: { session_id: "furniture-test" },
        });
        setUserRooms(res.data.rooms || []);
      } catch {
        toast.error("Failed to fetch uploaded rooms");
      }
    };

  const fetchLibrary = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/furniture/all", {
        params: { session_id: "furniture-test" },
      });
      setLibrary(res.data.furnitures || []);
    } catch {
      toast.error("Failed to load furniture library");
    }
  };

  // --- Handlers ---
  const handleDesignSelect = async (designId) => {
    setSelectedDesignId(designId);
    setSelectedUserRoomId(null);
    setSelectedRoomImage(null);

    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/design/${designId}/image`);
      setSelectedRoomImage(res.data.image);
    } catch {
      toast.error("Failed to load design image");
    }
  };

  const handleUserRoomSelect = (room) => {
    setSelectedUserRoomId(room.id);
    setSelectedDesignId(null);
    setSelectedRoomImage(room.image);
  };

  const handleRoomUpload = async () => {
    if (!pendingRoomFile) return toast.error("Select a room image");
    const form = new FormData();
    form.append("session_id", "furniture-test");
    form.append("room_image", pendingRoomFile);

    try {
      await axios.post("http://127.0.0.1:8000/api/rooms/upload", form);
      toast.success("Room uploaded!");
      setPendingRoomFile(null);
      fetchUserRooms();
    } catch {
      toast.error("Upload failed");
    }
  };

  const handleFurnitureSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return toast.error("Upload an image");
    setPendingUploadFile(file);
    setSelectedLibraryFurniture(null);
    setFurniturePreview(URL.createObjectURL(file));
  };

  const handleFurnitureUpload = async () => {
    if (!pendingUploadFile) return toast.error("No furniture selected");
    const form = new FormData();
    form.append("session_id", "furniture-test");
    form.append("name", pendingUploadFile.name);
    form.append("furniture_image", pendingUploadFile);

    try {
      await axios.post("http://127.0.0.1:8000/api/furniture/upload", form);
      toast.success("Added to library");
      setFurniturePreview(null);
      setPendingUploadFile(null);
      fetchLibrary();
      setFileInputKey(Date.now());
    } catch {
      toast.error("Upload failed");
    }
  };

  const handlePlaceFurniture = async (e) => {
    e.preventDefault();
    if (!selectedDesignId && !selectedUserRoomId) return toast.error("Select a room");
    if (!pendingUploadFile && !selectedLibraryFurniture) return toast.error("Select furniture");

    setLoading(true);
    const form = new FormData();
    form.append("session_id", "furniture-test");
    if (selectedDesignId) form.append("design_id", selectedDesignId);
    if (selectedUserRoomId) form.append("user_room_id", selectedUserRoomId);
    if (selectedLibraryFurniture) form.append("furniture_ids", selectedLibraryFurniture.id);
    if (pendingUploadFile) form.append("furniture_images", pendingUploadFile);
    form.append("furniture_descriptions", furnitureDescription);

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/place-furniture", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult({
        image: res.data.image,
        text: res.data.text,
        timestamp: new Date().toLocaleString(),
      });
      toast.success("Furniture placed successfully!");
    } catch {
      toast.error("Failed to place furniture");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFurniture = () => {
    setPendingUploadFile(null);
    setFurniturePreview(null);
    setFurnitureDescription("");
    setSelectedLibraryFurniture(null);
  };

  const handleNewTest = () => {
    setSelectedDesignId(null);
    setSelectedUserRoomId(null);
    setSelectedRoomImage(null);
    handleClearFurniture();
    setResult(null);
  };

  const getDesignLabel = (design) => {
    const type = design.metadata?.room_type || "Room";
    const style = design.metadata?.style || "Design";
    const date = new Date(design.created_at).toLocaleDateString();
    return `${type} - ${style} (${date})`;
  };

  const handleSaveGeneratedRoom = async (imageDataUrl) => {
    try {
      const formData = new FormData();
      formData.append("session_id", "furniture-test"); // Replace with actual session
      formData.append("room_image", dataURLtoFile(imageDataUrl, "generated_room.png"));
      formData.append("room_description", "Generated AI Room");

      await axios.post("http://127.0.0.1:8000/api/rooms/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Generated room saved to library!");
      fetchUserRooms(); // refresh user rooms
    } catch (err) {
      console.error(err);
      toast.error("Failed to save room");
    }
  };

  // Helper function to convert data URL to File
  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  return (
    <div style={{ padding: "2rem 1rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <Title level={2} style={{ color: textColor, textAlign: "center" }}>
          Furniture Placement Tool
        </Title>
        <Text style={{ color: textColor, display: "block", textAlign: "center", marginBottom: "2rem" }}>
          Select any room design or your uploaded room and place your furniture
        </Text>

        {!result ? (
          <form onSubmit={handlePlaceFurniture}>
            <Row gutter={[24, 24]}>
              {/* --- Room selection --- */}
              <Col xs={24} md={12}>
                <Card title="Step 1: Select Room" style={{ background: bgColor, borderColor }}>
                  <Text style={{ color: textColor }}>Generated Designs:</Text>
                  <Select
                    placeholder="Select a design"
                    style={{ width: "100%", marginBottom: 16 }}
                    value={selectedDesignId}
                    onChange={handleDesignSelect}
                  >
                    {generatedDesigns.map(d => (
                      <Option key={d.id} value={d.id}>{getDesignLabel(d)}</Option>
                    ))}
                  </Select>

                  <Text style={{ color: textColor }}>Your Uploaded Rooms:</Text>
                  {userRooms.length === 0 ? (
                    <Empty description="No uploaded rooms" />
                  ) : (
                    <Row gutter={[8, 8]}>
                      {userRooms.map(room => (
                        <Col key={room.id} span={12}>
                          <Card
                            hoverable
                            onClick={() => handleUserRoomSelect(room)}
                            style={{
                              border: selectedUserRoomId === room.id ? "2px solid blue" : "1px solid gray",
                            }}
                          >
                            <img src={room.image} style={{ width: "100%", borderRadius: 8 }} />
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}

                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPendingRoomFile(e.target.files[0])}
                    style={{ marginTop: 8 }}
                  />
                  {pendingRoomFile && (
                    <Button onClick={handleRoomUpload} type="primary" style={{ marginTop: 8 }}>
                      Upload Room
                    </Button>
                  )}

                  {selectedRoomImage && (
                    <img src={selectedRoomImage} alt="Selected Room" style={{ width: "100%", marginTop: 16, borderRadius: 12 }} />
                  )}
                </Card>
              </Col>

              {/* --- Furniture selection --- */}
              <Col xs={24} md={12}>
                <Card title="Step 2: Select / Upload Furniture" style={{ background: bgColor, borderColor }}>
                  <Input type="file" accept="image/*" onChange={handleFurnitureSelect} style={{ marginBottom: 8 }} />
                  {pendingUploadFile && (
                    <Button type="primary" onClick={handleFurnitureUpload} style={{ marginBottom: 16 }}>
                      Upload to Library
                    </Button>
                  )}
                  {furniturePreview && (
                    <img src={furniturePreview} style={{ width: "100%", maxHeight: 300, objectFit: "contain", marginBottom: 16 }} />
                  )}
                  <Text style={{ color: textColor }}>Furniture Library:</Text>
                  <Row gutter={[8, 8]}>
                    {library.map(f => (
                      <Col key={f.id} span={12}>
                        <Card
                          hoverable
                          onClick={() => setSelectedLibraryFurniture(f)}
                          style={{ border: selectedLibraryFurniture?.id === f.id ? "2px solid blue" : "1px solid gray" }}
                        >
                          <img src={f.image} style={{ width: "100%", borderRadius: 8 }} />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                  <Input.TextArea
                    rows={3}
                    placeholder="Furniture description (optional)"
                    value={furnitureDescription}
                    onChange={(e) => setFurnitureDescription(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              </Col>
            </Row>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <Button type="primary" htmlType="submit" size="large" loading={loading}>
                {loading ? "Placing..." : "Place Furniture"}
              </Button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Card style={{ background: bgColor, borderColor,width: "70%", }}>
              <img src={result.image} alt="Result" style={{ width: "100%", borderRadius: 12 }} />
              {result.text && <Text style={{display: "block", textAlign: "center"}}>{result.text}</Text>}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8  }}>
                <Button type="primary" onClick={handleNewTest}>Test Another Furniture</Button>
                <Button type="default" onClick={() => handleSaveGeneratedRoom(result.image)}>
                  Save to Library
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
      <ToastContainer theme={isDarkMode ? "dark" : "light"} />
    </div>
  );
}

export default FurniturePlacement;
