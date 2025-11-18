import React, { useState } from 'react';
import axios from 'axios';
import { Button, Typography, Row, Col, Card, Spin, Image, Divider } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import ImageUpload from './components/ImageUpload'; 

const { Title, Text } = Typography;

const SearchFurniture = ({ isDarkMode }) => {
    const [uploadedImage, setUploadedImage] = useState(null); 
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState(null);
    
    const textColor = isDarkMode ? "#e4e4e4" : "#111827";
    const cardBg = isDarkMode ? "#1f1f1f" : "#ffffff";

    const handleImageChange = (file, url) => {
        setUploadedImage(file);
        setUploadedImageUrl(url); 
        setSearchResults(null);
    };

    const handleSearch = async () => {
        if (!uploadedImage) {
            toast.error("Vui lòng tải lên ảnh vật phẩm hoặc phòng để phân tích.");
            return;
        }

        setLoading(true);
        setSearchResults(null);
        
        const formData = new FormData();
        formData.append("uploaded_image", uploadedImage);

        try {
            const response = await axios.post("http://127.0.0.1:8000/api/analyze-and-search", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            // Backend trả về 'description', 'product_links', và 'generated_queries'
            setSearchResults(response.data);
            toast.success("Phân tích và tìm kiếm sản phẩm hoàn tất!");

        } catch (error) {
            console.error("Lỗi khi phân tích và tìm kiếm:", error);
            setUploadedImageUrl(null); 
            toast.error("Tìm kiếm thất bại. Vui lòng kiểm tra console.");
        } finally {
            setLoading(false);
        }
    };

    // --- HÀM RENDER CÁC TRUY VẤN ĐÃ TẠO ---
    const renderGeneratedQueries = () => {
        if (!searchResults || !searchResults.generated_queries || searchResults.generated_queries.length === 0) {
            return <Text style={{ color: isDarkMode ? '#a1a1aa' : '#666' }}>Không có truy vấn nào được tạo.</Text>;
        }

        return (
            <div style={{ marginTop: 10 }}>
                <Text strong style={{ color: textColor, display: 'block' }}>Truy vấn AI đã sử dụng:</Text>
                {searchResults.generated_queries.map((item, index) => (
                    <Text 
                        key={index} 
                        code 
                        style={{ display: 'block', color: textColor, fontSize: '0.9em', margin: '5px 0' }}
                    >
                        {item.item_name || item.name}: "{item.query}"
                    </Text>
                ))}
            </div>
        );
    };


    // --- HÀM NHÓM VÀ RENDER SẢN PHẨM (ĐÃ CÓ KHOẢNG CÁCH 24PX) ---
    const renderGroupedProducts = () => {
        if (!searchResults || !searchResults.product_links) return null;

        const grouped = searchResults.product_links.reduce((acc, product) => {
            const key = product.item_name || "Sản phẩm Khác";
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(product);
            return acc;
        }, {});

        // 2. Hiển thị từng nhóm
        return Object.entries(grouped).map(([itemName, products]) => (
            <div key={itemName} style={{ marginBottom: 30 }}>
                {/* Tiêu đề cho nhóm món đồ */}
                <Title level={4} style={{ color: textColor, marginTop: 0, paddingBottom: 5, fontSize: '1.2em' }}>
                    {itemName}
                </Title>
                
                <Row gutter={[16, 16]}>
                    {products.map((product, index) => (
                        <Col xs={24} key={index}>
                            <Card 
                                style={{ background: cardBg, borderColor: isDarkMode ? '#303030' : '#f0f0f0' }}
                                styles={{ header: { padding: 12, display: 'flex' } }}
                            >
                                <Image
                                    src={product.thumbnail}
                                    alt={product.title}
                                    width={70}
                                    preview={false}
                                    // ✅ ĐÃ SỬA: Thiết lập marginRight: 24 để tăng khoảng cách rõ rệt
                                    style={{ objectFit: 'contain', borderRadius: 4, marginRight: 30 }} 
                                />
                                <div style={{ flexGrow: 1 }}>
                                    <Text strong style={{ color: textColor, display: 'block' }}>{product.title}</Text>
                                    <Text style={{ display: 'block', color: '#1677ff', fontWeight: 'bold' }}>{product.price}</Text>
                                    <Text style={{ display: 'block', color: isDarkMode ? '#a1a1aa' : '#666', fontSize: '0.9em' }}>{product.source}</Text>
                                    <Button 
                                        type="link" 
                                        href={product.link}
                                        // ✅ ĐÃ SỬA: Đảm bảo mở link trong tab mới
                                        target="_blank" 
                                        size="small" 
                                        style={{ paddingLeft: 0, marginTop: 4 }}
                                    >
                                        Xem sản phẩm
                                    </Button>
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </div>
        ));
    };

    return (
        <>
            <Title 
                level={2} 
                style={{ color: textColor, textAlign: "center", marginBottom: "2rem" }}
            >
                Image-based Furniture Search
            </Title>
            
            <Row gutter={[32, 32]} justify="center" style={{ marginTop: '2rem' }}>
                
                {/* Cột Trái: Ảnh đã Upload và Mô tả tổng quan */}
                <Col xs={24} lg={10}>
                    <Title level={4} style={{ color: textColor, marginBottom: 16 }}>Phòng đã phân tích:</Title>
                    
                    <Card 
                        style={{ background: cardBg, borderColor: isDarkMode ? '#303030' : '#f0f0f0' }}
                        styles={{body: { padding: 16 }}}
                    >
                        {uploadedImageUrl && searchResults ? (
                            // HIỂN THỊ KẾT QUẢ ĐÃ PHÂN TÍCH (ẢNH GỐC & MÔ TẢ AI)
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <img
                                    src={uploadedImageUrl}
                                    alt="Uploaded Furniture"
                                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8 }}
                                />
                                
                                <Text strong style={{ color: textColor, display: 'block', marginTop: 10 }}>Mô tả AI:</Text>
                                <Text style={{ color: textColor }}>{searchResults.description}</Text>
                                
                                <Divider />

                                {/* GỌI HÀM HIỂN THỊ TRUY VẤN MỚI */}
                                {renderGeneratedQueries()} 
                                
                                <Text style={{ fontSize: 12, color: isDarkMode ? '#a1a1aa' : '#666', marginTop: 10 }}>File: {uploadedImage?.name || '---'}</Text>
                            </div>
                        ) : (
                            // FORM UPLOAD BAN ĐẦU
                            <>
                                <ImageUpload
                                    label="Tải lên ảnh Vật phẩm hoặc Phòng"
                                    onImageChange={handleImageChange}
                                    isDarkMode={isDarkMode}
                                />
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<SearchOutlined />}
                                    loading={loading}
                                    onClick={handleSearch}
                                    style={{ width: '100%', marginTop: '1rem', height: 48 }}
                                    disabled={!uploadedImage}
                                >
                                    {loading ? "Đang phân tích..." : "Phân tích và Tìm kiếm"}
                                </Button>
                            </>
                        )}
                        
                    </Card>
                </Col>

                {/* Cột Phải: Danh sách Sản phẩm ĐÃ NHÓM */}
                <Col xs={24} lg={14}>
                    <Title level={4} style={{ color: textColor, marginBottom: 16 }}>Các sản phẩm tìm thấy</Title>
                    
                    <Card 
                        style={{ background: cardBg, minHeight: 300, borderColor: isDarkMode ? '#303030' : '#f0f0f0' }}
                        bodyStyle={{ padding: 16 }}
                    >
                        {loading && <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" /></div>}
                        
                        {searchResults && searchResults.product_links && searchResults.product_links.length > 0 ? (
                            renderGroupedProducts()
                        ) : (
                            searchResults && !loading && (
                                <Text style={{ color: textColor }}>
                                    Không tìm thấy sản phẩm nào. Vui lòng kiểm tra "Truy vấn AI đã sử dụng" ở bên trái để biết các truy vấn đã được thực hiện.
                                </Text>
                            )
                        )}

                    </Card>
                </Col>
            </Row>
        </>
    );
};

export default SearchFurniture;
